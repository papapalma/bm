require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey);

const runMigration = async () => {
  console.log('\n📝 Running migration: add-trainee-fields.sql');
  
  const sql = fs.readFileSync('./database/add-trainee-fields.sql', 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`);
    
    try {
      // Use raw SQL query through Supabase's SQL editor equivalent
      // Note: This requires executing via psql or Supabase dashboard
      console.log('⚠️  Statement needs to be run via Supabase SQL Editor or psql');
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }

  console.log('\n✅ Migration script generated!');
  console.log('\n📋 Instructions:');
  console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to "SQL Editor"');
  console.log('4. Create a new query');
  console.log('5. Paste the contents of database/add-trainee-fields.sql');
  console.log('6. Click "Run" to execute the migration\n');
};

runMigration();
