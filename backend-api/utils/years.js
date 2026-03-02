const CANONICAL_YEARS = [
    'B-Tech 1st Year',
    'B-Tech 2nd Year',
    'B-Tech 3rd Year',
    'B-Tech 4th Year'
];

const YEAR_ALIASES = {
    '1st Year': 'B-Tech 1st Year',
    '2nd Year': 'B-Tech 2nd Year',
    '3rd Year': 'B-Tech 3rd Year',
    '4th Year': 'B-Tech 4th Year',
    'B-Tech 1st Year': 'B-Tech 1st Year',
    'B-Tech 2nd Year': 'B-Tech 2nd Year',
    'B-Tech 3rd Year': 'B-Tech 3rd Year',
    'B-Tech 4th Year': 'B-Tech 4th Year'
};

const normalizeYear = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    return YEAR_ALIASES[value.trim()] || null;
};

const normalizeYears = (values = []) => {
    if (!Array.isArray(values)) {
        return [];
    }
    return values.map(normalizeYear).filter(Boolean);
};

const isValidYear = (value) => Boolean(normalizeYear(value));

module.exports = {
    CANONICAL_YEARS,
    normalizeYear,
    normalizeYears,
    isValidYear
};
