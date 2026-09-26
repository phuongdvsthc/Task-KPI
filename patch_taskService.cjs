const fs = require('fs');
let content = fs.readFileSync('src/services/taskService.ts', 'utf-8');

const replacement = `
      const ownerPromise = task.owner_id 
        ? (supabase.from('profiles') as any).select('*').eq('id', task.owner_id).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const creatorPromise = task.created_by
        ? (supabase.from('profiles') as any).select('*').eq('id', task.created_by).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [
        unitRes,
        ownerRes,
        creatorRes,
        assigneesRes,
        updatesRes,
        evidenceRes,
        commentsRes,
      ] = await Promise.all([
        task.organization_unit_id ? (supabase.from('organization_units') as any).select('*').eq('id', task.organization_unit_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ownerPromise,
        creatorPromise,
        (supabase.from('task_assignees') as any).select('*, profile:profiles(*)').eq('task_id', taskId),
        (supabase.from('task_updates') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        (supabase.from('task_evidence') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        (supabase.from('task_comments') as any).select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      ]);
`;

content = content.replace(/const \[\s*unitRes,\s*ownerRes,\s*creatorRes,\s*assigneesRes,\s*updatesRes,\s*evidenceRes,\s*commentsRes,\s*\] = await Promise\.all\(\[\s*\(supabase\.from\('organization_units'\) as any\)\.select\('\*'\)\.eq\('id', task\.organization_unit_id\)\.maybeSingle\(\),\s*\(supabase\.from\('profiles'\) as any\)\.select\('\*'\)\.eq\('id', task\.owner_id\)\.maybeSingle\(\),\s*\(supabase\.from\('profiles'\) as any\)\.select\('\*'\)\.eq\('id', task\.created_by\)\.maybeSingle\(\),\s*\(supabase\.from\('task_assignees'\) as any\)\.select\('\*, profile:profiles\(\*\)'\)\.eq\('task_id', taskId\),\s*\(supabase\.from\('task_updates'\) as any\)\.select\('\*'\)\.eq\('task_id', taskId\)\.order\('created_at', \{ ascending: false \}\),\s*\(supabase\.from\('task_evidence'\) as any\)\.select\('\*'\)\.eq\('task_id', taskId\)\.order\('created_at', \{ ascending: false \}\),\s*\(supabase\.from\('task_comments'\) as any\)\.select\('\*'\)\.eq\('task_id', taskId\)\.order\('created_at', \{ ascending: true \}\),\s*\]\);/, replacement.trim());

fs.writeFileSync('src/services/taskService.ts', content);
