const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /import express, \{ Request, Response \} from 'express';/,
    `import express, { Request, Response } from 'express';\nimport { aiService } from './src/services/ai/aiService';`
);

fs.writeFileSync('server.ts', content);
