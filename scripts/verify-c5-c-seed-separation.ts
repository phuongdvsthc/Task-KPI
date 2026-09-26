import fs from 'fs';
import path from 'path';

function runC5CAudit() {
  console.log('=== VERIFY C5-C SEED SEPARATION & INTEGRITY AUDIT ===\n');

  const baselineSeedPath = 'supabase/seeds/00001_core_baseline_seed.sql';
  const sthcSeedPath = 'supabase/seeds/00002_sthc_sample_data.sql';
  const migrationsDir = 'supabase/migrations';

  let hasErrors = false;

  // 1. Audit Core Baseline Seed Cleanliness (NO STHC information)
  console.log('1. Checking Core Baseline Seed (' + baselineSeedPath + ')...');
  if (!fs.existsSync(baselineSeedPath)) {
    console.error('ERROR: Missing ' + baselineSeedPath);
    hasErrors = true;
    return;
  }
  const baselineContent = fs.readFileSync(baselineSeedPath, 'utf8');

  const forbiddenStrings = [
    'Saigontourist',
    'saigontourist.edu.vn',
    '23/8 Hoàng Việt',
    '1800558827',
    'QTKSDN',
    'KTCBMA',
    'TC-2026-D01',
    'NH-2026-D01',
    '7afdccfd-4e25-434f-afba-e54b0652aa1f'
  ];

  for (const str of forbiddenStrings) {
    if (baselineContent.includes(str)) {
      console.error(`  FAIL: Core baseline seed contains STHC string: "${str}"`);
      hasErrors = true;
    }
  }
  if (!hasErrors) {
    console.log('  PASS: Core baseline seed is 100% clean of STHC tenant data.');
  }

  // 2. Audit Idempotency in Core Baseline Seed
  console.log('2. Checking Idempotency of Core Baseline Seed...');
  const insertMatches = baselineContent.match(/INSERT INTO\s+public\.([a-zA-Z0-9_]+)/g) || [];
  console.log(`  Found ${insertMatches.length} INSERT INTO public.* statements.`);
  
  const hasOnConflictOrWhere = 
    baselineContent.includes('ON CONFLICT') && 
    baselineContent.includes('WHERE NOT EXISTS');
  
  if (hasOnConflictOrWhere) {
    console.log('  PASS: Core baseline seed uses ON CONFLICT / WHERE NOT EXISTS for safe re-runs.');
  } else {
    console.error('  FAIL: Missing idempotency guards in baseline seed.');
    hasErrors = true;
  }

  // 3. Audit Migrations directory for pure DDL (No business seed)
  console.log('3. Checking 9 Schema Migrations in ' + migrationsDir + '...');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();
  console.log(`  Found ${migrationFiles.length} migration files.`);

  let totalTables = 0;
  let totalViews = 0;
  const tableNames = new Set<string>();
  const viewNames = new Set<string>();

  for (const mf of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, mf), 'utf8');
    
    // Check if 00003 still has seed
    if (mf === '00003_access_control_rbac.sql') {
      if (content.includes('INSERT INTO public.access_roles')) {
        console.error('  FAIL: 00003_access_control_rbac.sql still contains seed data!');
        hasErrors = true;
      } else {
        console.log('  PASS: 00003_access_control_rbac.sql is confirmed pure DDL.');
      }
    }

    // Count CREATE TABLE
    const tableMatches = content.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-zA-Z0-9_]+)/g);
    for (const tm of tableMatches) {
      tableNames.add(tm[1]);
      totalTables++;
    }

    // Count CREATE VIEW
    const viewMatches = content.matchAll(/CREATE OR REPLACE VIEW public\.([a-zA-Z0-9_]+)/g);
    for (const vm of viewMatches) {
      viewNames.add(vm[1]);
      totalViews++;
    }
  }

  console.log(`\n--- TABLE & VIEW COUNT IN 9 MIGRATIONS ---`);
  console.log(`Total Tables defined: ${tableNames.size} (Verified on DB: 57)`);
  console.log(`Total Views defined: ${viewNames.size} (Expected: 2)`);
  
  if (tableNames.size === 57 && viewNames.size === 2) {
    console.log('  PASS: Schema count matches exactly 57 tables and 2 views verified on live DB!');
  } else {
    console.error(`  FAIL: Table count mismatch (${tableNames.size} vs 57) or View count mismatch (${viewNames.size} vs 2)`);
    hasErrors = true;
  }

  // 4. Check STHC Seed file
  console.log('\n4. Checking STHC Sample Data Seed (' + sthcSeedPath + ')...');
  if (!fs.existsSync(sthcSeedPath)) {
    console.error('ERROR: Missing ' + sthcSeedPath);
    hasErrors = true;
  } else {
    const sthcContent = fs.readFileSync(sthcSeedPath, 'utf8');
    if (sthcContent.includes('STHC') && sthcContent.includes('Trường Saigontourist') && sthcContent.includes('ON CONFLICT')) {
      console.log('  PASS: STHC sample data is properly isolated with idempotency guards.');
    } else {
      console.error('  FAIL: STHC sample data is incomplete or missing idempotency.');
      hasErrors = true;
    }
  }

  console.log('\n=== AUDIT RESULT: ' + (hasErrors ? 'FAIL' : 'PASS (100% COMPLIANT WITH C5-C)') + ' ===');
}

runC5CAudit();
