require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPasswords() {
  console.log('🔧 Fixing default user passwords...\n');
  
  const correctHash = '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu';
  
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: correctHash })
    .in('email', ['admin@inventory.com', 'staff@inventory.com'])
    .select();
  
  if (error) {
    console.error('❌ Error updating passwords:', error.message);
    process.exit(1);
  }
  
  console.log(`✅ Updated ${data.length} user(s)`);
  console.log('\nYou can now login with:');
  console.log('  Email: admin@inventory.com');
  console.log('  Password: admin123');
  console.log('\nOr:');
  console.log('  Email: staff@inventory.com');
  console.log('  Password: admin123');
}

fixPasswords();
