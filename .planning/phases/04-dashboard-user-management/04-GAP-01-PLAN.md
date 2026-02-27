---
phase: 04-dashboard-user-management
plan: GAP-01
type: gap_closure
wave: 1
depends_on: ["04-01", "04-02"]
gap_closure: true
gap_id: DASH-02
files_modified:
  - frontend/src/admin-app/src/components/dashboard/ChartSection.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Dashboard shows at least one interactive chart with actual data visualization"
    - "Chart renders using Chart.js or Recharts library"
    - "Chart data is passed via props or fetched from API"
    - "Chart type toggle buttons switch between different chart visualizations"
    - "Chart displays actual data, not just a placeholder"
  artifacts:
    - path: "frontend/src/admin-app/src/components/dashboard/ChartSection.tsx"
      provides: "Chart section with actual chart implementation"
      exports: ["ChartSection", "ChartType"]
      min_lines: 150
  key_links:
    - from: "frontend/src/admin-app/src/components/dashboard/ChartSection.tsx"
      to: "recharts OR chart.js"
      via: "Chart library import"
      pattern: "import.*from.*(recharts|chart.js)"
---

<objective>
Implement actual chart visualizations in ChartSection component using Chart.js or Recharts to replace the static placeholder.

**Purpose:** Requirement DASH-02 requires "Statistics charts (Library Ref Distribution, Users per Library, File vs URL, Knowledge Stats)" - currently the component only shows a placeholder text.

**Output:** ChartSection component rendering actual charts using a charting library with mock data (until real API data is available).
</objective>

<execution_context>
@/home/mlk/.claude/get-shit-done/workflows/execute-plan.md
@/home/mlk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@frontend/src/admin-app/src/components/dashboard/ChartSection.tsx
@frontend/src/admin-app/package.json
</context>

<tasks>

<task type="auto">
  <name>Choose and install chart library</name>
  <files>frontend/src/admin-app/package.json</files>
  <action>
    Select and install a charting library:

    **Option A: Recharts (Recommended for React)**
    - React-native charting library
    - Composable components
    - Good TypeScript support
    - Install: `npm install recharts`

    **Option B: Chart.js**
    - Popular, well-documented
    - Requires react-chartjs-2 wrapper for React
    - Install: `npm install chart.js react-chartjs-2`

    **Decision criteria:**
    - Prefer Recharts for better React integration
    - Check if chart.js already exists in main app (reuse if available)
    - Consider bundle size and TypeScript support

    **Add to package.json dependencies**
  </action>
  <verify>
    - Check chart library is installed
    - Verify TypeScript types are available
    - Confirm library can be imported
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Chart library (Recharts or Chart.js) installed and available for use.
  </done>
</task>

<task type="auto">
  <name>Define chart data interfaces and mock data</name>
  <files>frontend/src/admin-app/src/components/dashboard/ChartSection.tsx</files>
  <action>
    Add chart data structures:

    **1. Define data interfaces for each chart type:**
    ```tsx
    interface LibraryRefData {
      name: string
      value: number
    }

    interface UsersPerLibraryData {
      libraryName: string
      users: number
    }

    interface FileVsUrlData {
      type: string
      count: number
    }

    interface KnowledgeStatsData {
      knowledge: string
      documents: number
      queries: number
    }
    ```

    **2. Create mock data generators:**
    ```tsx
    const generateLibraryRefData = (): LibraryRefData[] => [
      { name: 'Science', value: 45 },
      { name: 'Technology', value: 32 },
      { name: 'History', value: 28 },
      { name: 'Arts', value: 15 },
    ]

    // Similar functions for other chart types
    ```

    **3. Add data state to component**
  </action>
  <verify>
    - Verify all data interfaces are defined
    - Check mock data generators return correct structure
    - Confirm data matches chart library requirements
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Chart data interfaces and mock data generators defined for all 4 chart types.
  </done>
</task>

<task type="auto">
  <name>Implement chart rendering with Recharts</name>
  <files>frontend/src/admin-app/src/components/dashboard/ChartSection.tsx</files>
  <action>
    Replace placeholder with actual charts:

    **1. Import Recharts components:**
    ```tsx
    import {
      BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
      XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
    } from 'recharts'
    ```

    **2. Create chart config for each type:**
    ```tsx
    const renderChart = (type: ChartType, data: any) => {
      switch (type) {
        case 'library-ref':
          return (
            <PieChart width={500} height={300}>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )
        case 'users-per-library':
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="libraryName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="users" fill="#8884d8" />
            </BarChart>
          )
        // Similar for file-vs-url (LineChart) and knowledge-stats
      }
    }
    ```

    **3. Replace placeholder div with ResponsiveContainer containing chart**

    **4. Add colors array for pie chart segments**
  </action>
  <verify>
    - Verify all 4 chart types render correctly
    - Check charts are responsive
    - Confirm tooltips display data on hover
    - Test legend visibility
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    ChartSection renders actual charts using Recharts for all 4 chart types with proper styling and tooltips.
  </done>
</task>

<task type="auto">
  <name>Wire chart data to toggle state</name>
  <files>frontend/src/admin-app/src/components/dashboard/ChartSection.tsx</files>
  <action>
    Connect chart data to selected chart type:

    **1. Add memoized data generation:**
    ```tsx
    const chartData = useMemo(() => {
      switch (selectedChart) {
        case 'library-ref': return generateLibraryRefData()
        case 'users-per-library': return generateUsersPerLibraryData()
        case 'file-vs-url': return generateFileVsUrlData()
        case 'knowledge-stats': return generateKnowledgeStatsData()
      }
    }, [selectedChart])
    ```

    **2. Pass data to chart renderer**

    **3. Add smooth transitions between chart types (optional)**

    **4. Add loading state when switching charts**
  </action>
  <verify>
    - Click each chart type button - verify correct data displays
    - Check chart updates when toggling between types
    - Verify no console errors during transitions
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Chart data correctly wired to toggle state, displaying appropriate data for each selected chart type.
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build:admin` to verify TypeScript compilation
2. Check that Recharts (or Chart.js) is properly imported
3. Verify all 4 chart types render with actual visualizations
4. Confirm charts are responsive and display tooltips
5. Test chart type switching updates the visualization
6. Verify no placeholder text remains
</verification>

<success_criteria>
1. Chart library installed and configured
2. All 4 chart types (Library Ref, Users per Library, File vs URL, Knowledge Stats) render actual charts
3. Charts display mock data with proper formatting
4. Tooltips show data values on hover
5. Charts are responsive to container size
6. TypeScript compilation passes with npm run build:admin
7. DASH-02 requirement fully satisfied
</success_criteria>

<requirements_covered>
- DASH-02: Statistics charts (Library Ref Distribution, Users per Library, File vs URL, Knowledge Stats) - FULLY IMPLEMENTED
</requirements_covered>

<output>
After completion, create `.planning/phases/04-dashboard-user-management/04-GAP-01-SUMMARY.md` with:
- Chart library selected and why
- Chart types implemented with descriptions
- Mock data structure for each chart
- Known limitations (e.g., mock data vs real API)
- DASH-02 requirement marked as VERIFIED
</output>
