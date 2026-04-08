module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 150], // Increase limit to 150
    "body-max-line-length": [2, "always", 200], // Increase limit to 200
  },
};
