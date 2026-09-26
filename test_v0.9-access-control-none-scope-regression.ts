// Simple test for can() logic
const SCOPE_RANKS = {
  none: 0,
  own: 1,
  unit: 2,
  unit_tree: 3,
  all: 4,
};

function can(capabilityCode: string, scope: string | null, minimumScope?: string): boolean {
  if (scope === null) return false;
  if (!minimumScope) return true;
  if (scope === 'none') return false;

  const currentRank = SCOPE_RANKS[scope as keyof typeof SCOPE_RANKS] || 0;
  const requiredRank = SCOPE_RANKS[minimumScope as keyof typeof SCOPE_RANKS] || 0;
  return currentRank >= requiredRank;
}

// 1. Grant tồn tại, scope_code = none -> can() trả true (khi không yêu cầu min scope)
console.log('Test 1:', can('test.view', 'none') === true);
// 2. Grant không tồn tại -> can() trả false
console.log('Test 2:', can('test.none', null) === false);
// 3. Grant có all -> can() trả true (khi yêu cầu min scope own)
console.log('Test 3:', can('test.view', 'all', 'own') === true);
// 4. Grant có own -> can() trả true (khi yêu cầu min scope own)
console.log('Test 4:', can('test.view', 'own', 'own') === true);
// 5. Grant có own -> can() trả false (khi yêu cầu min scope unit)
console.log('Test 5:', can('test.view', 'own', 'unit') === false);
// 6. Grant có none -> can() trả false (khi yêu cầu min scope own)
console.log('Test 6:', can('test.view', 'none', 'own') === false);
