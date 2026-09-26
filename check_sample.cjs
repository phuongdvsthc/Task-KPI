const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRow() {
  const { data: assignments, error } = await supabase
    .from('kpi_assignments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching assignment:', error);
    return;
  }

  if (assignments && assignments.length > 0) {
    console.log('Sample kpi_assignment columns:', Object.keys(assignments[0]));
  } else {
    console.log('No assignments found.');
  }

  // Also check kpi_assignment_reviews table
  const { data: revs, error: rErr } = await supabase
    .from('kpi_assignment_reviews')
    .select('*')
    .limit(1);
  console.log('kpi_assignment_reviews query:', { hasData: !!revs, error: rErr });

  // Also check kpi_assignment_item_reviews table
  const { data: itemRevs, error: irErr } = await supabase
    .from('kpi_assignment_item_reviews')
    .select('*')
    .limit(1);
  console.log('kpi_assignment_item_reviews query:', { hasData: !!itemRevs, error: irErr });
}

checkRow();
