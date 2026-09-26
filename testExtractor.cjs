const { execSync } = require('child_process');

// We can compile executiveIssueExtractor and run a mock test.
const fs = require('fs');
execSync('npx tsc --noEmit', {stdio: 'inherit'});
console.log("Types check pass.");
