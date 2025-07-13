# Available Tools

## code-health ⭐ NEW
Unified code health analysis combining all quality tools
```bash
code-health                          # Overall health score & priorities
code-health src/                     # Analyze specific directory
code-health -f summary               # Text summary with score (default)
code-health -f json                  # JSON output for automation
code-health -f dashboard             # HTML dashboard with charts
code-health -o report.html           # Save to file
code-health -f json | jq '.health_score'                    # Extract score
code-health -f json | jq '.priorities[:5]'                  # Top 5 priorities
code-health -f json | jq -e '.health_score >= 70'          # CI/CD gate
code-health | grep "high complexity" | head -3              # Quick issues
code-health -f json > health-$(date +%Y%m%d).json          # Track over time
```

## migration-planner ⭐ NEW
Complex migration orchestration with risk assessment and phased planning
```bash
migration-planner                            # Feature migration planning
migration-planner --type feature             # New features (default)
migration-planner --type api                 # API changes/breaking changes
migration-planner --type architecture        # Major structural changes
migration-planner --type platform            # Platform migrations (React→Vue)
migration-planner --type refactor            # Large-scale improvements
migration-planner --pattern "geofence"       # Find all geofence code
migration-planner --pattern "auth"           # Authentication migration
migration-planner -t api -p "v1"            # API v1 to v2 migration
migration-planner src/ -p "database"         # Database layer changes
migration-planner | grep "CRITICAL"          # Check for blockers
migration-planner | grep "Duration"          # Get time estimate
migration-planner > migration-plan.md        # Save full plan
migration-planner | grep -A20 "PHASE 0"      # See preparation tasks
```

## refactor-analyzer ⭐ NEW
AI-optimized refactoring analysis orchestrator
```bash
refactor-analyzer                    # Quick wins analysis
refactor-analyzer --profile quick    # Fast improvements (default)
refactor-analyzer --profile deep     # Structural analysis
refactor-analyzer --profile architecture  # Full system review
refactor-analyzer src/               # Analyze specific directory
refactor-analyzer -p deep > plan.txt # Save refactoring plan
refactor-analyzer | grep "HIGH"      # Find high-priority issues
refactor-analyzer | grep "CRITICAL"  # Find blockers
refactor-analyzer -p quick | pbcopy  # Copy to clipboard for AI
```

## mermaid-gen
Generate mermaid diagrams from directory structure
```bash
mermaid-gen                          # Current directory, flowchart, outputs diagram.png
mermaid-gen /path/to/dir             # Specific directory
mermaid-gen -t graph                 # Graph layout instead of flowchart
mermaid-gen -t mindmap               # Mindmap layout
mermaid-gen -t grid                  # Grid layout (square output)
mermaid-gen -o custom.png            # Custom output filename
mermaid-gen -d 3                     # Limit depth to 3 levels
mermaid-gen src/ -t grid -d 2        # Grid layout, 2 levels deep
```

## code-deps
Visualize code dependencies between files
```bash
code-deps                            # Current directory, outputs code_dependencies.png
code-deps src/                       # Specific directory
code-deps -o deps.png                # Custom output filename
code-deps -d 2                       # Limit depth to 2 levels
code-deps --no-external              # Skip external dependencies
```

## fs-json
Generate JSON representation of file system
```bash
fs-json                              # Current directory, saves to file_system.json
fs-json src/                         # Specific directory
fs-json -o structure.json            # Custom output filename
fs-json -d 3                         # Limit depth to 3 levels
fs-json --include-hidden             # Include hidden files
```

## type-extract
Extract TypeScript types to stdout (for piping)
```bash
type-extract                         # Current directory, summary format
type-extract src/                    # Specific directory
type-extract -f detailed             # Detailed output with all properties
type-extract -f json                 # JSON format for processing
type-extract -f markdown             # Markdown documentation
type-extract -i "*.test.ts"          # Ignore test files
type-extract | grep interface        # Pipe to grep for filtering
type-extract -f json | jq .interfaces # Process with jq
```

## type-extractor
Extract TypeScript types to file
```bash
type-extractor                       # Saves to types_summary.txt
type-extractor src/                  # Specific directory
type-extractor -f detailed           # Saves to types_detailed.txt
type-extractor -f json               # Saves to types.json
type-extractor -f markdown           # Saves to types.md
type-extractor -o custom.txt         # Custom output filename
type-extractor -i "*.test.ts" "temp" # Ignore patterns
```

## dep-analyzer
Analyze import dependencies and circular references
```bash
dep-analyzer                         # Summary of dependencies
dep-analyzer src/                    # Specific directory
dep-analyzer --circular-check        # Check for circular dependencies
dep-analyzer -f graph                # GraphViz dot format output
dep-analyzer -f circular             # Only show circular deps
dep-analyzer --chains ErrorManager   # Show import chains to ErrorManager
dep-analyzer -f chains --chains API  # Detailed chains to API
dep-analyzer -d 5                    # Max depth for chains (default: 10)
dep-analyzer -i test dist            # Ignore directories
```

## complexity-check
Analyze cyclomatic complexity
```bash
complexity-check                     # Default threshold 10
complexity-check src/                # Specific directory
complexity-check -t 15               # Set threshold to 15
complexity-check -f detailed         # Show all functions sorted
complexity-check -f threshold        # Only show threshold violations
complexity-check -f json             # JSON output
complexity-check -s loc              # Sort by lines of code
complexity-check -s nesting          # Sort by nesting depth
complexity-check -i "*.min.js"       # Ignore minified files
```

## code-metrics
Calculate LOC and code metrics
```bash
code-metrics                         # Full summary with language breakdown
code-metrics src/                    # Specific directory
code-metrics --loc                   # Simple line count only
code-metrics -f detailed             # Detailed file analysis
code-metrics -f languages            # Language statistics
code-metrics -f files                # List files by metrics
code-metrics -f json                 # JSON output
code-metrics -s size                 # Sort by file size
code-metrics -s functions            # Sort by function count
code-metrics --top 30                # Show top 30 files
code-metrics -e .ts .tsx             # Only TypeScript files
code-metrics -i test build           # Ignore patterns
```

## api-usage
Find all usages of APIs/functions/classes
```bash
api-usage LocationUpdate             # Find all uses of LocationUpdate
api-usage getUserLocation src/       # Search in specific directory
api-usage -f callsites processData   # Show only where it's called
api-usage -f detailed                # Detailed usage report
api-usage -f detailed --group type   # Group by usage type
api-usage -f detailed --group file   # Group by file (default)
api-usage -f hierarchy MyClass       # Show call hierarchy
api-usage -f json APIClient          # JSON output
api-usage -c 5 handleError           # Show 5 lines of context
api-usage -e LocationManager         # Include usage examples
```

## test-mapper
Map test coverage and find gaps
```bash
test-mapper                          # Summary with coverage percentage
test-mapper src/                     # Specific directory
test-mapper --coverage-gaps          # Show only untested files
test-mapper -f gaps                  # Detailed gaps with suggestions
test-mapper -f coverage              # Coverage by directory
test-mapper -f detailed              # All file-to-test mappings
test-mapper -f orphans               # Find orphan test files
test-mapper -f json                  # JSON output
test-mapper --no-gaps                # Hide gaps in summary
test-mapper -i e2e integration       # Ignore test types
```

## doc-gen
Generate documentation from JSDoc/comments
```bash
doc-gen                              # Markdown to stdout
doc-gen src/                         # Specific directory
doc-gen -f markdown                  # Markdown format (default)
doc-gen -f html                      # HTML documentation
doc-gen -f json                      # JSON format
doc-gen -f summary                   # Summary only
doc-gen -o api-docs.md               # Save to file
doc-gen --no-examples                # Exclude code examples
doc-gen -f html > docs.html          # Redirect to file
doc-gen -i test temp                 # Ignore patterns
```

## gitingest
Extract GitHub repository content for AI analysis
```bash
gitingest                                           # Analyze current repo
gitingest --output summary.md                       # Save analysis to file
gitingest --include-tests                           # Include test files
gitingest https://github.com/user/repo              # Basic extraction to digest.txt
gitingest URL -o analysis.txt                       # Custom output file
gitingest URL --stdout                              # Output to stdout for piping
gitingest URL --exclude-common                      # Exclude junk files (recommended)
gitingest URL -i "*.py" -i "*.js"                  # Only Python and JS files
gitingest URL -e "tests/*" -e "docs/*"             # Exclude specific paths
gitingest URL -s 51200                              # Max 50KB file size
gitingest URL -b develop                            # Specific branch
gitingest URL --exclude-common --show-ignored       # Debug what's excluded
gitingest URL -i "*.md" -i "*.rst"                 # Documentation only
gitingest URL --exclude-common -i "*.ts" -i "*.tsx" # TypeScript project
gitingest URL | grep -A10 "Summary:"                # Quick repo overview
```

## Common Patterns

### Piping and Composition
```bash
type-extract -f json | jq '.interfaces[] | select(.name | contains("Config"))'
api-usage MyAPI -f json | jq '.usages[] | select(.type == "call")'
code-metrics -f json | jq '.files | sort_by(.code_lines) | reverse | .[0:10]'
```

### Coverage Analysis Workflow
```bash
test-mapper --coverage-gaps > gaps.txt
complexity-check -f threshold > complex.txt
grep -f complex.txt gaps.txt  # Find complex untested files
```

### Documentation Pipeline
```bash
type-extractor -f markdown -o types.md
doc-gen -o api.md
cat types.md api.md > full-docs.md
```