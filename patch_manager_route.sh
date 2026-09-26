awk '
/import { KpiAssignmentDetailView } from '\''..\/assignments\/KpiAssignmentDetailView'\'';/ {
    print $0
    print "import { KpiUnitDetailPlaceholder } from \"./drilldown/KpiUnitDetailPlaceholder\";"
    print "import { KpiDetailPlaceholder } from \"./drilldown/KpiDetailPlaceholder\";"
    next
}
/const \[selectedAssignmentId, setSelectedAssignmentId\] = useState<string | null>\(null\);/ {
    # Replace this local state with parsing the hash
    print "  const hash = window.location.hash;"
    print "  const drilldownAssignmentMatch = hash.match(/\\/dashboard\\/assignment\\/([a-zA-Z0-9-]+)/);"
    print "  const drilldownUnitMatch = hash.match(/\\/dashboard\\/unit\\/([a-zA-Z0-9-]+)/);"
    print "  const drilldownKpiMatch = hash.match(/\\/dashboard\\/kpi\\/([^&]+)/);"
    next
}
/if \(selectedAssignmentId\) {/ {
    skip = 1
    # Replace the drilldown rendering logic
    print "  if (drilldownAssignmentMatch) {"
    print "    return ("
    print "      <KpiAssignmentDetailView"
    print "        assignmentId={drilldownAssignmentMatch[1]}"
    print "        onBack={() => { window.location.hash = \"#/kpis/dashboard\"; }}"
    print "      />"
    print "    );"
    print "  }"
    print "  if (drilldownUnitMatch) {"
    print "    return ("
    print "      <KpiUnitDetailPlaceholder"
    print "        unitId={drilldownUnitMatch[1]}"
    print "        onBack={() => { window.location.hash = \"#/kpis/dashboard\"; }}"
    print "      />"
    print "    );"
    print "  }"
    print "  if (drilldownKpiMatch) {"
    print "    return ("
    print "      <KpiDetailPlaceholder"
    print "        kpiKey={drilldownKpiMatch[1]}"
    print "        onBack={() => { window.location.hash = \"#/kpis/dashboard\"; }}"
    print "      />"
    print "    );"
    print "  }"
    next
}
/onClick={() => setSelectedAssignmentId(item.id)}/ {
    print "              onClick={() => { window.location.hash = `#/kpis/dashboard/assignment/${item.id}`; }}"
    next
}
skip && /^  }/ {
    skip = 0
    next
}
skip { next }
{ print }
' src/components/kpis/dashboard/KpiManagerDashboardView.tsx > tmp.tsx && mv tmp.tsx src/components/kpis/dashboard/KpiManagerDashboardView.tsx
