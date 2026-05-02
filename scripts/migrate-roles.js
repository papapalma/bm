#!/usr/bin/env node

/**
 * Apply role migration to database
 * Migrates from 2-role system (admin, staff) to 3-role system (admin, staff-inventory, staff-trainees)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Starting role migration...\n');

  try {
    // Step 1: Get existing users
    console.log('Step 1: Checking existing users...');
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, username, role');
    
    if (fetchError) throw fetchError;
    
    console.log(`   Found ${existingUsers.length} users:`);
    existingUsers.forEach(u => console.log(`   - ${u.email} (${u.role})`));
    console.log();

    // Step 2: Update old inventory.com users to new BMDC emails
    console.log('Step 2: Updating old users to BMDC emails...');
    
    // Update admin@inventory.com -> admin@bmdc.edu.ph
    const adminUser = existingUsers.find(u => u.email === 'admin@inventory.com');
    if (adminUser) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          email: 'admin@bmdc.edu.ph',
          username: 'admin',
          role: 'admin'
        })
        .eq('id', adminUser.id);
      
      if (updateError) throw updateError;
      console.log('   ✅ Updated admin@inventory.com -> admin@bmdc.edu.ph');
    }
    
    // Update staff@inventory.com -> inventory@bmdc.edu.ph with new role
    const staffUser = existingUsers.find(u => u.email === 'staff@inventory.com');
    if (staffUser) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          email: 'inventory@bmdc.edu.ph',
          username: 'staff-inventory',
          role: 'staff-inventory'
        })
        .eq('id', staffUser.id);
      
      if (updateError) throw updateError;
      console.log('   ✅ Updated staff@inventory.com -> inventory@bmdc.edu.ph (staff-inventory)');
    }
    console.log();

    // Step 3: Update any remaining staff users to staff-inventory
    console.log('Step 3: Updating remaining staff roles...');
    const usersWithStaffRole = existingUsers.filter(u => 
      u.role === 'staff' && 
      u.email !== 'admin@inventory.com' && 
      u.email !== 'staff@inventory.com'
    );
    
    for (const user of usersWithStaffRole) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'staff-inventory' })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      console.log(`   ✅ Updated ${user.email}: staff -> staff-inventory`);
    }
    console.log();

    // Step 4: Insert trainee staff user if not exists
    console.log('Step 4: Creating trainee staff user...');
    
    // Check if trainees user exists
    const { data: existingTraineesUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'trainees@bmdc.edu.ph')
      .single();
    
    if (!existingTraineesUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: 'trainees@bmdc.edu.ph',
          username: 'staff-trainees',
          password_hash: '$2a$10$d.hOU/nLCUmdfBchSJen7ueMozsc50O1Jt8/vXGo882OEeXBfoDIu',
          role: 'staff-trainees'
        });
      
      if (insertError) throw insertError;
      console.log('   ✅ Created trainees@bmdc.edu.ph (staff-trainees)');
    } else {
      console.log('   ℹ️  trainees@bmdc.edu.ph already exists');
    }
    console.log();

    // Step 5: Verify migration
    console.log('Step 5: Verifying migration...');
    const { data: finalUsers, error: verifyError } = await supabase
      .from('users')
      .select('id, email, username, role, created_at')
      .order('created_at');
    
    if (verifyError) throw verifyError;
    
    console.log(`   ✅ Final user count: ${finalUsers.length}`);
    console.log('\n   Users in database:');
    finalUsers.forEach(u => {
      console.log(`   - ${u.email.padEnd(30)} | ${u.username.padEnd(20)} | ${u.role}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nDefault credentials (password: admin123):');
    console.log('- admin@bmdc.edu.ph (Administrator)');
    console.log('- inventory@bmdc.edu.ph (Staff - Inventory)');
    console.log('- trainees@bmdc.edu.ph (Staff - Trainees)');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

runMigration();
