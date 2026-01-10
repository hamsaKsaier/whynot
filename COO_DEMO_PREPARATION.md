# COO Demo Preparation Checklist

## ✅ Completed Tasks

1. ✅ **Database Migration** - Created migration script (`run-migration.sh`)
2. ✅ **Folder Expansion Fix** - Fixed folder expansion state initialization
3. ✅ **Folder Creation UI** - Added folder modal with color picker
4. ✅ **Folder Assignment UI** - Added dropdown to assign user stories to folders
5. ✅ **Error Handling** - Enhanced error messages for network failures and edge cases
6. ✅ **API Verification** - Confirmed flow-data endpoint returns folders correctly

## 📋 Remaining Manual Tasks

### 1. Run Database Migration

```bash
# Option 1: Using the migration script
./run-migration.sh

# Option 2: Manual execution
docker-compose exec database psql -U thundercode -d thundercode < services/database/migrations/004_user_story_folders.sql

# Verify migration
docker-compose exec database psql -U thundercode -d thundercode -c "\d user_story_folders"
```

### 2. Prepare Demo Data

**Create Projects:**
1. Navigate to `/projects`
2. Create 2-3 projects (e.g., "WeQuizz App", "E-commerce Platform")
3. Add website URLs for each project

**Create User Stories:**
1. For each project, create 2-3 user stories:
   - "As a user, I want to login to the application"
   - "As a user, I want to view my dashboard"
   - "As a user, I want to update my profile"

**Generate Test Cases:**
1. For each user story, click "Generate Tests"
2. Wait for test generation to complete
3. Verify test cases appear

**Create Folders:**
1. Navigate to `/architecture-flow`
2. Click "Create Folder" button
3. Create folders like:
   - "Authentication" (color: blue)
   - "Dashboard" (color: green)
   - "User Profile" (color: purple)

**Assign User Stories to Folders:**
1. Navigate to project detail page
2. For each user story, use the "Folder" dropdown
3. Assign stories to appropriate folders

### 3. Test End-to-End Flow

**Test Flow:**
1. ✅ Navigate to Projects page → Create/select project
2. ✅ Create user story
3. ✅ Generate test cases
4. ✅ Navigate to Architecture Flow
5. ✅ Verify folders display
6. ✅ Verify user stories are in folders
7. ✅ Click test case to expand steps
8. ✅ Use visibility filters
9. ✅ Click play button on test case
10. ✅ Verify test execution starts
11. ✅ Check test results page

**Test Error Handling:**
- Disconnect network → Verify error message
- Stop test executor service → Verify error message
- Try invalid inputs → Verify validation

## 🎯 Demo Script (5-7 minutes)

### 1. Project Management (30s)
- Show Projects page
- Highlight organized structure

### 2. User Story & Test Generation (1-2 min)
- Create user story
- Generate test cases
- Show generated steps

### 3. Architecture Flow (2 min) ⭐ **KEY FEATURE**
- Navigate to Architecture Flow
- Show hierarchical view
- **Demonstrate:**
  - Collapsible test steps (click to expand)
  - Visibility filters (toggle node types)
  - Folder organization
  - Run test from flow (play button)

### 4. Test Execution (1-2 min)
- Execute test from Architecture Flow
- Show live browser preview
- Highlight real-time monitoring

### 5. Results & Analysis (1 min)
- Show test results page
- Display screenshots
- Show pass/fail status

## 🚨 Known Issues & Workarounds

1. **Folder expansion** - Folders expand automatically on load
2. **First project only** - Folder creation button uses first project (for demo)
3. **Network errors** - Enhanced error messages guide users

## 📝 Quick Reference

### Key Features to Highlight
- ✅ AI-Powered Test Generation
- ✅ Visual Architecture Flow
- ✅ Folder Organization
- ✅ One-Click Test Execution
- ✅ Real-Time Monitoring
- ✅ Production Ready

### Backup Plan
- Screenshots/video of demo flow
- Test data backup
- API documentation ready

## 🔧 Troubleshooting

**Migration fails:**
```bash
# Check database connection
docker-compose ps database

# Check logs
docker-compose logs database
```

**Folders not showing:**
- Verify migration ran successfully
- Check browser console for errors
- Refresh Architecture Flow page

**Test execution fails:**
- Verify all services are running: `docker-compose ps`
- Check gateway logs: `docker-compose logs gateway`
- Check test-executor logs: `docker-compose logs test-executor`






