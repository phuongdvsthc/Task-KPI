const fs = require('fs');

try {
  const openapi = JSON.parse(fs.readFileSync('./openapi.json', 'utf8'));
  console.log("=== kpi_assignments definitions ===");
  if (openapi.definitions && openapi.definitions.kpi_assignments) {
    console.log(JSON.stringify(openapi.definitions.kpi_assignments.properties, null, 2));
  } else {
    console.log("kpi_assignments not found in definitions. Keys:", Object.keys(openapi.definitions || {}));
  }

  console.log("\n=== kpi_assignment_reviews definitions ===");
  if (openapi.definitions && openapi.definitions.kpi_assignment_reviews) {
    console.log(JSON.stringify(openapi.definitions.kpi_assignment_reviews.properties, null, 2));
  }

  console.log("\n=== kpi_assignment_item_reviews definitions ===");
  if (openapi.definitions && openapi.definitions.kpi_assignment_item_reviews) {
    console.log(JSON.stringify(openapi.definitions.kpi_assignment_item_reviews.properties, null, 2));
  }

  console.log("\n=== RPC paths matching kpi ===");
  const paths = Object.keys(openapi.paths || {}).filter(p => p.includes('kpi'));
  console.log(paths);
} catch (err) {
  console.error(err);
}
