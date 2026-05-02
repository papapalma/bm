#!/usr/bin/env node

/**
 * Step 1: Alter database constraint to allow new roles
 * This must be run BEFORE the data migration
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function alterConstraint() {
  console.log('🔄 Altering database constraint...\n');

  try {
    // Execute raw SQL to alter the constraint
    console.log('Dropping old CHECK constraint...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;'
    });

    // Try alternative approach using Postgres admin if RPC doesn't exist
    if (dropError && dropError.message.includes('Could not find')) {
      console.log('⚠️  RPC function not available, providing SQL for manual execution:\n');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`
-- Step 1: Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add new constraint with 3 roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'staff-inventory', 'staff-trainees'));

-- Step 3: Verify constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'users_role_check';
`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('\nAfter running the SQL above, run: node scripts/migrate-roles.js');
      return;
    }

    if (dropError) throw dropError;
    console.log('   ✅ Dropped old constraint\n');

    console.log('Adding new CHECK constraint...');
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff-inventory', 'staff-trainees'));"
    });

    if (addError) throw addError;
    console.log('   ✅ Added new constraint\n');

    console.log('✅ Constraint updated successfully!');
    console.log('Now run: node scripts/migrate-roles.js');

  } catch (error) {
    console.error('\n❌ Failed to alter constraint:', error.message);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Please run this SQL manually in Supabase SQL Editor:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`
-- Step 1: Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add new constraint with 3 roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'staff-inventory', 'staff-trainees'));
`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nAfter running the SQL above, run: node scripts/migrate-roles.js');
  }
}

alterConstraint();
