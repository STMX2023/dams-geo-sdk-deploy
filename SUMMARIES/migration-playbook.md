# Complex Migration Playbook

A Systematic Guide to Large-Scale Codebase Migrations Using Automated Analysis Tools

---

## 📋 OVERVIEW

This playbook provides a proven methodology for executing complex migrations (API changes, architectural shifts, platform migrations) safely and systematically. Based on real-world analysis of polygon→circular geofencing migration in a production SDK.

**Key Principles:**
- Evidence-based planning over assumption-driven development
- Risk identification before code changes
- Quantified success metrics throughout the process
- Automated analysis to reveal hidden dependencies

---

## 🎯 PHASE 0: INITIAL ASSESSMENT & DISCOVERY

**Purpose:** Understand scope and establish baseline

### Step 1: Codebase Health Check

```
# Get overall health baseline
code-health -f json > baseline-health.json
code-health -f dashboard -o baseline-dashboard.html
```
```
# Extract key metrics
jq '.health_score' baseline-health.json          # Overall health
jq '.score_breakdown' baseline-health.json      # Component scores
```
⚠️ **STOP CONDITIONS:**
- Health score < 40: Address critical issues first
- Test coverage < 20%: Write tests before migration
- High complexity + no tests: Migration too risky

### Step 2: Migration Scope Analysis

```
# Identify affected code patterns
migration-planner --type api --pattern "your_target_pattern"
migration-planner --type architecture --pattern "component_name"
```
```
# Find all usage locations
api-usage YourTargetAPI -f detailed
api-usage YourTargetClass -f callsites
api-usage target_function -f hierarchy
```
**Key Outputs:**
- Affected file count and locations
- Risk assessment (CRITICAL/HIGH/MEDIUM/LOW)
- Migration path recommendation

### Step 3: Dependency Impact Analysis

```
# Check for circular dependencies
dep-analyzer --circular-check
```
```
# Map dependency chains
dep-analyzer --chains YourTargetComponent -d 10
dep-analyzer -f graph | grep -A 5 -B 5 "target"
```
```
# Identify coupling issues
dep-analyzer -f summary
```
**Critical Discoveries:**
- What depends on your migration target?
- Are there circular dependencies that could break?
- How deep are the dependency chains?

### Step 4: API Surface Extraction

```
# Extract type definitions
type-extract -f json > current-types.json
type-extract src/your_module/ -f detailed
```
```
# Document current API contracts
type-extract -f markdown > api-baseline.md
```
**Documentation Baseline:**
- Current interface definitions
- Type relationships
- API contracts that must be preserved

---

## 🔍 PHASE 1: DEEP ANALYSIS & RISK ASSESSMENT

**Purpose:** Uncover hidden complexities and risks

### Step 5: Complexity Analysis

```
# Identify complex functions in target area
complexity-check src/target_module/ -f threshold
complexity-check -f detailed | grep "your_target"
```
```
# Find high-complexity files
complexity-check -f json | jq '.files[] | select(.max_complexity > 15)'
```
**Red Flags:**
- Functions with complexity > 20 in migration path
- Large files (>300 LOC) that need changes
- Deep nesting (>5 levels) in critical code

### Step 6: Test Coverage Assessment

```
# Map test coverage gaps
test-mapper -f gaps
test-mapper src/target_module/ -f detailed
test-mapper --coverage-gaps > test-gaps.txt
```
```
# Find untested complex code
complexity-check -f threshold > complex.txt
grep -f complex.txt test-gaps.txt
```
**Critical Analysis:**
- Which complex code has no tests?
- What are the highest-risk untested areas?
- How much test writing is needed before migration?

### Step 7: Database & Storage Impact

```
# Find database-related code
api-usage coordinates -f detailed        # Data structure fields
api-usage schema -f callsites           # Schema references
api-usage migration -f detailed         # Existing migration code
```
```
# Check for data persistence patterns
grep -r "JSON.stringify\|JSON.parse" src/
grep -r "INSERT\|UPDATE\|CREATE TABLE" src/
```
**Storage Impact Assessment:**
- Are data structures stored in databases?
- Will migration require schema changes?
- Is there existing migration infrastructure?

### Step 8: Cross-Module Impact Analysis

```
# Check usage across entire codebase
api-usage YourTargetAPI src/ -f detailed
api-usage YourDataStructure . -f callsites
```
```
# Find indirect dependencies
dep-analyzer --chains YourModule
dep-analyzer -f graph > dependency-graph.dot
```
**Hidden Dependencies:**
- Which modules indirectly use your target?
- Are there unexpected coupling points?
- What will break if you change the interface?

---

## 📊 PHASE 2: QUANTIFIED PLANNING & STRATEGY

**Purpose:** Create data-driven migration plan

### Step 9: Refactoring Priority Analysis

```
# Get refactoring recommendations
refactor-analyzer --profile deep > refactor-plan.txt
refactor-analyzer | grep "HIGH\|CRITICAL"
```
```
# Focus on migration area
refactor-analyzer src/target_module/ --profile architecture
```
**Strategic Guidance:**
- What should be refactored before migration?
- Which improvements will reduce migration risk?
- What's the recommended sequence of changes?

### Step 10: Code Metrics & Scope Sizing

```
# Understand codebase scale
code-metrics -f summary
code-metrics src/target_area/ -f detailed
code-metrics --sort functions --top 10
```
```
# Language and file distribution
code-metrics -f languages
code-metrics -f files --sort size --top 20
```
**Scope Quantification:**
- Lines of code affected
- Number of files to modify
- Function and class counts
- Language distribution

### Step 11: Documentation Gap Analysis

```
# Check current documentation
doc-gen src/target_module/ -f summary
doc-gen -f json | jq '.items | length'
```
```
# Find undocumented APIs
doc-gen src/ -f json > docs.json
type-extract -f json > types.json
# Compare to find gaps
```
**Documentation Requirements:**
- How much documentation exists?
- What APIs lack documentation?
- Will migration require doc updates?

---

## ⚡ PHASE 3: RAPID VALIDATION & PROTOTYPING

**Purpose:** Validate approach before full implementation

### Step 12: Create Migration Branch & Baseline

```
# Create feature branch
git checkout -b feature/your-migration-name
```
```
# Establish measurement baseline
code-health -f json > pre-migration-baseline.json
test-mapper -f json > pre-migration-coverage.json
complexity-check -f json > pre-migration-complexity.json
```
### Step 13: Proof of Concept Implementation

```
# Target the simplest migration component first
# Make minimal changes to validate approach
```
```
# Continuous monitoring during POC
code-health src/target_module/ -f json
complexity-check src/target_module/ -f threshold
test-mapper src/target_module/ -f coverage
```
**Validation Criteria:**
- Does the basic approach work?
- Are there unexpected blockers?
- Do existing tests pass?
- Is complexity under control?

---

## 🚀 PHASE 4: SYSTEMATIC IMPLEMENTATION

**Purpose:** Execute migration with continuous monitoring

### Step 14: Test-First Development

```
# Before each change, verify current test coverage
test-mapper src/current_target/ -f detailed
```
```
# After writing tests, verify coverage improvement
test-mapper src/current_target/ -f coverage
```
**Testing Strategy:**
- Write tests for complex functions before modifying
- Maintain >80% coverage on modified code
- Test both old and new behavior during transition

### Step 15: Incremental Implementation with Monitoring

```
# After each significant change
code-health src/modified_area/ -f json | jq '.health_score'
complexity-check src/modified_area/ -f threshold
dep-analyzer --circular-check
```
```
# Track progress
echo "$(date): $(code-health -f json | jq '.health_score')" >> progress.log
```
**Continuous Validation:**
- Health score shouldn't decrease
- No new circular dependencies
- Complexity stays under thresholds
- All tests continue passing

### Step 16: Integration Point Validation

```
# Verify dependent modules still work
api-usage YourChangedAPI -f detailed
dep-analyzer --chains YourModifiedComponent
```
```
# Check for breaking changes
api-usage YourOldAPI -f callsites  # Should show no usage
api-usage YourNewAPI -f detailed   # Should show expected usage
```
---

## ✅ PHASE 5: VALIDATION & ROLLOUT PREPARATION

**Purpose:** Ensure migration success

### Step 17: Comprehensive Health Check

```
# Full codebase validation
code-health -f json > post-migration-health.json
code-health -f dashboard -o post-migration-dashboard.html
```
```
# Compare with baseline
jq '.health_score' pre-migration-baseline.json
jq '.health_score' post-migration-health.json
```
**Success Criteria:**
- Health score maintained or improved
- Test coverage maintained or improved
- No new high-complexity functions
- No circular dependencies introduced

### Step 18: Performance & Quality Benchmarks

```
# Complexity improvement validation
complexity-check -f json > post-migration-complexity.json
# Compare max complexity before/after
```
```
# Test coverage validation
test-mapper -f json > post-migration-coverage.json
# Ensure coverage maintained or improved
```
```
# Documentation completeness
doc-gen -f summary
```
### Step 19: Migration Impact Report

```
# Generate comprehensive comparison
migration-planner --type api --pattern "your_pattern" > final-impact.txt
```
```
# Create final documentation
doc-gen src/ -o final-api-docs.md
type-extract -f markdown > final-types.md
```
---

## 📝 TOOL USAGE SUMMARY

**Essential Tools (Must Use):**

1.  `migration-planner` - Initial scope and risk assessment
2.  `code-health` - Baseline and progress monitoring
3.  `api-usage` - Find all affected code locations
4.  `test-mapper` - Coverage gaps and testing strategy
5.  `complexity-check` - Identify high-risk functions
6.  `dep-analyzer` - Dependency and coupling analysis

**Supporting Tools (Highly Recommended):**

7.  `type-extract` - API contract documentation
8.  `refactor-analyzer` - Strategic improvement guidance
9.  `code-metrics` - Scope sizing and progress tracking
10. `doc-gen` - Documentation gap analysis

**Specialized Tools (Use When Needed):**

11. `gitingest` - Codebase context for complex migrations
12. Visual diagrams - Architecture understanding
13. `fs-json` - File structure analysis for large changes

---

## 🎯 CRITICAL SUCCESS FACTORS

**Stop/Go Decision Points:**

-   **RED (Stop):** Health score < 40, Critical complexity with no tests
-   **YELLOW (Proceed with Caution):** Health score 40-60, High complexity functions
-   **GREEN (Proceed):** Health score > 60, Good test coverage, Manageable complexity

**Continuous Monitoring Thresholds:**

-   Health score shouldn't drop >10 points
-   Max complexity shouldn't exceed 20
-   Test coverage shouldn't drop >5%
-   No new circular dependencies

**Risk Mitigation Patterns:**

-   **High Complexity + No Tests:** Write comprehensive tests first
-   **Database Schema Changes:** Create migration scripts and rollback procedures
-   **Cross-Module Dependencies:** Phase changes with backward compatibility
-   **Breaking API Changes:** Use feature flags and gradual rollout

---

## ⚠️ COMMON PITFALLS & SOLUTIONS

### Pitfall 1: Hidden Database Dependencies

**Solution:** Always run `api-usage data_field_name` to find storage usage

### Pitfall 2: Underestimating Test Requirements

**Solution:** Run `test-mapper` and `complexity-check` together to find risk areas

### Pitfall 3: Circular Dependency Creation

**Solution:** Run `dep-analyzer --circular-check` after every significant change

### Pitfall 4: Breaking Downstream Consumers

**Solution:** Use `api-usage YourAPI -f hierarchy` to map all usage

### Pitfall 5: Complexity Explosion

**Solution:** Monitor with `complexity-check -f threshold` and refactor when needed

---

## 📊 SUCCESS METRICS

**Quantified Targets:**

-   **Health Score:** Maintain or improve baseline
-   **Test Coverage:** Maintain >80% on modified code
-   **Complexity:** Max function complexity <15
-   **Dependencies:** Zero new circular dependencies
-   **Documentation:** 100% of public APIs documented

---

## 🔄 ITERATION & IMPROVEMENT

### Post-Migration Analysis:

```
# Document lessons learned
code-health -f json > final-state.json
echo "Migration completed: $(date)" >> migration-log.txt
```
```
# Compare predictions vs reality
diff initial-scope.txt actual-scope.txt
```
### Process Refinement:

-   Which tools provided the most value?
-   What risks were missed in initial analysis?
-   What would you do differently?

---

This playbook transforms risky migrations into systematic, evidence-based engineering projects. The tools provide the data; this process provides the methodology. 🎯