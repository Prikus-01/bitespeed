/**
 * Validates the request body for the POST /identify endpoint.
 * Returns an error message string if invalid, or null if valid.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ email?: string, phoneNumber?: number }} body
 * @returns {string|null}  Error message, or null if valid.
 */
export const validateIdentifyInput = (body) => {
	const { email, phoneNumber } = body ?? {};

	const hasEmail = typeof email === 'string' && email.trim() !== '';
	const hasPhone = typeof phoneNumber === 'number' && Number.isFinite(phoneNumber);

	if (!hasEmail && !hasPhone) {
		return 'At least one of email or phoneNumber must be provided.';
	}

	if (hasEmail && !EMAIL_REGEX.test(email.trim())) {
		return 'Invalid email format.';
	}

	if (hasPhone && !/^\+?[\d\s\-().]{1,20}$/.test(String(phoneNumber).trim())) {
		return 'Invalid phoneNumber format.';
	}

	return null;
};
