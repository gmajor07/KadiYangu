function serializeJsonValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    JSON.parse(value);
    return value;
  }
  return JSON.stringify(value);
}
module.exports = { serializeJsonValue };
