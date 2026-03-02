import pool from '../utils/database.js';
import logger from '../utils/logger.js';
import { validateIdentifyInput } from '../utils/validation.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a set of raw contact rows, walks linkedId chains and returns all rows
 * that belong to the same cluster (same ultimate primary).
 */
const fetchCluster = async (client, primaryId) => {
    const { rows } = await client.query(
        `SELECT * FROM contact
      WHERE (id = $1 OR "linkedId" = $1)
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC`,
        [primaryId],
    );
    return rows;
};

/**
 * Builds the standard response shape from a cluster of contact rows.
 */
const buildResponse = (clusterRows) => {
    const primary = clusterRows.find((r) => r.linkPrecedence === 'primary');
    const secondaries = clusterRows.filter((r) => r.linkPrecedence === 'secondary');

    // Collect unique, non-null values; primary's values first.
    const emails = [
        ...new Set(
            [primary.email, ...secondaries.map((r) => r.email)].filter(Boolean),
        ),
    ];
    const phoneNumbers = [
        ...new Set(
            [primary.phoneNumber, ...secondaries.map((r) => r.phoneNumber)].filter(Boolean),
        ),
    ];
    const secondaryContactIds = secondaries.map((r) => r.id);

    return {
        contact: {
            primaryContatctId: primary.id, // kept to match the spec (typo intentional)
            emails,
            phoneNumbers,
            secondaryContactIds,
        },
    };
};

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /identify
 *
 * Handles all 4 identity reconciliation cases:
 *   1. No existing contact → create new primary
 *   2. Exact match already exists → return consolidated cluster
 *   3. Partial match (new info) → create secondary
 *   4. Two separate primaries → merge (make newer one secondary)
 */
export const identify = async (req, res, next) => {
    try {
        // ── Validation ──
        const validationError = validateIdentifyInput(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const email = req.body.email?.trim() || null;
        // DB stores phoneNumber as VARCHAR — convert number to string for all queries
        const phoneNumber = req.body.phoneNumber?.toString() || null;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // ── Search for matching contacts ──
            const { rows: matches } = await client.query(
                `SELECT * FROM contact
          WHERE ("deletedAt" IS NULL)
            AND (
              ($1::varchar IS NOT NULL AND email = $1)
              OR
              ($2::varchar IS NOT NULL AND "phoneNumber" = $2)
            )
          ORDER BY "createdAt" ASC`,
                [email, phoneNumber],
            );
            
            // ═══════════════════════════════════════════════════════════════════════
            // CASE 1: No existing records → create a fresh primary contact
            // ═══════════════════════════════════════════════════════════════════════
            if (matches.length === 0) {
                logger.info(`[identify] Case 1 – Creating new primary (email=${email}, phone=${phoneNumber})`);

                const { rows: [newContact] } = await client.query(
                    `INSERT INTO contact ("phoneNumber", email, "linkedId", "linkPrecedence")
            VALUES ($1, $2, NULL, 'primary')
            RETURNING *`,
                    [phoneNumber, email],
                );

                await client.query('COMMIT');
                return res.status(200).json(buildResponse([newContact]));
            }

            // ── Resolve the primary IDs referenced by all match results ──
            // A match can be a secondary itself — walk up to its primary.
            const primaryIds = new Set();
            for (const row of matches) {
                if (row.linkPrecedence === 'primary') {
                    primaryIds.add(row.id);
                } else {
                    primaryIds.add(row.linkedId); // secondary → points to primary
                }
            }

            // ═══════════════════════════════════════════════════════════════════════
            // CASE 4: Two different primaries matched → merge the newer into the older
            // ═══════════════════════════════════════════════════════════════════════
            if (primaryIds.size > 1) {
                logger.info(`[identify] Case 4 – Merger of primaries: [${[...primaryIds].join(', ')}]`);

                // Fetch both primary rows to determine which is older
                const { rows: primaryRows } = await client.query(
                    `SELECT * FROM contact WHERE id = ANY($1::int[]) ORDER BY "createdAt" ASC`,
                    [[...primaryIds]],
                );

                const olderPrimary = primaryRows[0]; // earliest createdAt
                const newerPrimary = primaryRows[1];

                // Demote the newer primary → secondary
                await client.query(
                    `UPDATE contact
              SET "linkPrecedence" = 'secondary',
                  "linkedId"       = $1
            WHERE id = $2`,
                    [olderPrimary.id, newerPrimary.id],
                );

                // Reparent all existing children of the newer primary
                await client.query(
                    `UPDATE contact
              SET "linkedId" = $1
            WHERE "linkedId" = $2`,
                    [olderPrimary.id, newerPrimary.id],
                );

                // If neither email+phone combo already exists, insert a secondary
                const alreadyHasEmail = matches.some((r) => r.email === email);
                const alreadyHasPhone = matches.some((r) => r.phoneNumber === phoneNumber);

                if (email && phoneNumber && !(alreadyHasEmail && alreadyHasPhone)) {
                    // One of the fields is genuinely new — record it as a secondary
                    const newEmail = alreadyHasEmail ? null : email;
                    const newPhone = alreadyHasPhone ? null : phoneNumber;
                    if (newEmail || newPhone) {
                        await client.query(
                            `INSERT INTO contact ("phoneNumber", email, "linkedId", "linkPrecedence")
                VALUES ($1, $2, $3, 'secondary')`,
                            [newPhone, newEmail, olderPrimary.id],
                        );
                    }
                }

                await client.query('COMMIT');

                const cluster = await fetchCluster(client, olderPrimary.id);
                return res.status(200).json(buildResponse(cluster));
            }

            // Single primary from here on
            const [primaryId] = [...primaryIds];
            const existingCluster = await fetchCluster(client, primaryId);

            // ═══════════════════════════════════════════════════════════════════════
            // CASE 2: Both email AND phone already known in this cluster → no-op
            // ═══════════════════════════════════════════════════════════════════════
            const clusterHasEmail = !email || existingCluster.some((r) => r.email === email);
            const clusterHasPhone = !phoneNumber || existingCluster.some((r) => r.phoneNumber === phoneNumber);

            if (clusterHasEmail && clusterHasPhone) {
                logger.info(`[identify] Case 2 – No new info, returning existing cluster (primaryId=${primaryId})`);
                await client.query('COMMIT');
                return res.status(200).json(buildResponse(existingCluster));
            }

            // ═══════════════════════════════════════════════════════════════════════
            // CASE 3: New info → create a secondary contact
            // ═══════════════════════════════════════════════════════════════════════
            logger.info(`[identify] Case 3 – New info, adding secondary (primaryId=${primaryId})`);

            await client.query(
                `INSERT INTO contact ("phoneNumber", email, "linkedId", "linkPrecedence")
          VALUES ($1, $2, $3, 'secondary')`,
                [phoneNumber, email, primaryId],
            );

            await client.query('COMMIT');

            const updatedCluster = await fetchCluster(client, primaryId);
            return res.status(200).json(buildResponse(updatedCluster));

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        logger.error('[identify] Unhandled error:', err.message);
        next(err);
    }
};
