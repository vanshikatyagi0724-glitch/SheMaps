/**
 * SheMaps Backend - Comprehensive Verification Test Suite
 * Tests every requirement and edge case.
 */

const BASE_URL = process.env.API_URL || "http://localhost:5000/api";

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? "- " + details : ""}`);
    failedCount++;
  }
}

async function runVerification() {
  console.log(`\n======================================================`);
  console.log(`  SheMaps Backend Live Endpoint Verification Suite`);
  console.log(`  Target Base: ${BASE_URL}`);
  console.log(`======================================================\n`);

  try {
    // 1. GET /health
    console.log(`[Check 1] GET /health`);
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, "Health check returns 200 OK");
    assert(healthData.status === "ok", "Health status payload is { status: 'ok' }");

    // 2. GET /issues with supporterId
    console.log(`\n[Check 2] GET /issues with supporterId query`);
    const listRes = await fetch(`${BASE_URL}/issues?supporterId=test_supporter_alpha_01`);
    const listData = await listRes.json();
    assert(listRes.status === 200, "GET /issues returns 200 OK");
    assert(Array.isArray(listData), "Response is an array of issues");
    assert(listData.length >= 4, "Initial seed data contains at least 4 issues");
    assert(typeof listData[0].supported === "boolean", "Each issue has boolean 'supported' flag");
    assert(listData[0].supportCount !== undefined, "Field mapping uses camelCase 'supportCount'");
    assert(listData[0].latitude !== null && listData[0].longitude !== null, "Seed issues have valid latitude/longitude for map display");

    // 3. GET /issues with invalid filter value -> 400
    console.log(`\n[Check 3] GET /issues with invalid filter values`);
    const badFilterRes = await fetch(`${BASE_URL}/issues?status=InvalidStatus123`);
    const badFilterData = await badFilterRes.json();
    assert(badFilterRes.status === 400, "Invalid filter parameter returns 400 Bad Request");
    assert(badFilterData.error !== undefined, "Returns error payload");

    // 4. POST /issues (Valid create) -> 201
    console.log(`\n[Check 4] POST /issues (Valid Creation)`);
    const validIssuePayload = {
      title: "Broken streetlight near Metro Gate 3",
      description: "Bulb shattered, completely dark path leading to parking.",
      category: "Streetlight",
      location: "MG Road Metro, Gurugram",
      severity: "High",
      latitude: 28.4795,
      longitude: 77.0805,
    };

    const createRes = await fetch(`${BASE_URL}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validIssuePayload),
    });
    const createdIssue = await createRes.json();
    assert(createRes.status === 201, "POST /issues returns 201 Created");
    assert(createdIssue.id > 0, "Created issue has valid numeric ID");
    assert(createdIssue.title === validIssuePayload.title, "Title matches payload");
    assert(createdIssue.status === "Pending", "Status defaults to 'Pending'");
    assert(createdIssue.supportCount === 1, "supportCount defaults to 1");

    const createdId = createdIssue.id;

    // 4b. POST /issues with supporterId (Reporter counts as supporter)
    console.log(`\n[Check 4b] POST /issues with supporterId (Reporter is marked supported)`);
    const reporterId = "reporter_token_user_777";
    const reporterIssueRes = await fetch(`${BASE_URL}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validIssuePayload,
        title: "Pothole near community center",
        category: "Road Damage",
        supporterId: reporterId,
      }),
    });
    const reporterIssue = await reporterIssueRes.json();
    assert(reporterIssueRes.status === 201, "POST /issues with supporterId returns 201 Created");
    assert(reporterIssue.supported === true, "Created issue has supported: true for reporter");

    // Reporter cannot add second support to own report
    const selfSupportRes = await fetch(`${BASE_URL}/issues/${reporterIssue.id}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supporterId: reporterId }),
    });
    assert(selfSupportRes.status === 409, "Reporter cannot add second support to own report (409 Conflict)");

    // 5. POST /issues (Invalid create: missing location & short title) -> 400
    console.log(`\n[Check 5] POST /issues (Invalid Creation: Field Errors)`);
    const invalidPayload = {
      title: "No", // < 3 chars
      category: "InvalidCategory",
      location: "", // empty
      severity: "Urgent", // not in High/Medium/Low
      latitude: 28.47, // lat without lng (violates both-or-neither)
    };

    const invalidCreateRes = await fetch(`${BASE_URL}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });
    const invalidCreateData = await invalidCreateRes.json();
    assert(invalidCreateRes.status === 400, "Invalid payload returns 400 Bad Request");
    assert(invalidCreateData.details?.title !== undefined, "Contains field error for 'title'");
    assert(invalidCreateData.details?.location !== undefined, "Contains field error for 'location'");
    assert(invalidCreateData.details?.category !== undefined, "Contains field error for 'category'");
    assert(invalidCreateData.details?.severity !== undefined, "Contains field error for 'severity'");
    assert(invalidCreateData.details?.coordinates !== undefined, "Contains error for both-or-neither coordinates");

    // 6. POST /issues/:id/support (First time -> 201)
    console.log(`\n[Check 6] POST /issues/:id/support (First time support)`);
    const supporterId = "supporter_client_token_99999";
    const supportRes1 = await fetch(`${BASE_URL}/issues/${createdId}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supporterId }),
    });
    const supportData1 = await supportRes1.json();
    assert(supportRes1.status === 201, "First time support returns 201 Created");
    assert(supportData1.supportCount === 2, "supportCount incremented from 1 to 2");
    assert(supportData1.supported === true, "supported flag is true");

    // 7. POST /issues/:id/support (Same supporter twice -> 409)
    console.log(`\n[Check 7] POST /issues/:id/support (Duplicate support by same supporter)`);
    const supportRes2 = await fetch(`${BASE_URL}/issues/${createdId}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supporterId }),
    });
    const supportData2 = await supportRes2.json();
    assert(supportRes2.status === 409, "Duplicate support by same supporterId returns 409 Conflict");
    assert(supportData2.error.includes("already"), "Returns clear duplicate error message");

    // 8. PATCH /issues/:id/status (Valid transition: Pending -> In Progress) -> 200
    console.log(`\n[Check 8] PATCH /issues/:id/status (Valid Transition: Pending -> In Progress)`);
    const patchRes1 = await fetch(`${BASE_URL}/issues/${createdId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In Progress", note: "Assigned to maintenance technician" }),
    });
    const patchData1 = await patchRes1.json();
    assert(patchRes1.status === 200, "Valid status transition returns 200 OK");
    assert(patchData1.status === "In Progress", "Status updated to 'In Progress'");

    // 9. PATCH /issues/:id/status (Same status -> 409 Conflict)
    console.log(`\n[Check 9] PATCH /issues/:id/status (Same status -> 409 Conflict)`);
    const sameStatusRes = await fetch(`${BASE_URL}/issues/${createdId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In Progress" }),
    });
    assert(sameStatusRes.status === 409, "Setting same status returns 409 Conflict");

    // 10. PATCH /issues/:id/status (Invalid transition: In Progress -> Pending) -> 400
    console.log(`\n[Check 10] PATCH /issues/:id/status (Invalid Transition -> 400 Bad Request)`);
    const badTransitionRes = await fetch(`${BASE_URL}/issues/${createdId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Pending" }),
    });
    assert(badTransitionRes.status === 400, "Disallowed status transition returns 400 Bad Request");

    // 11. Nonexistent ID check -> 404
    console.log(`\n[Check 11] Nonexistent Issue ID -> 404 Not Found`);
    const nonExistentRes = await fetch(`${BASE_URL}/issues/999999/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Resolved" }),
    });
    assert(nonExistentRes.status === 404, "Targeting non-existent issue returns 404 Not Found");

    // 12. Malformed JSON Body -> 400 Bad Request
    console.log(`\n[Check 12] Malformed JSON Body -> 400 Bad Request`);
    const malformedRes = await fetch(`${BASE_URL}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ this is not valid json :;; ",
    });
    const malformedData = await malformedRes.json();
    assert(malformedRes.status === 400, "Malformed JSON syntax returns 400 Bad Request");
    assert(malformedData.error.includes("Malformed JSON"), "Returns clean JSON error response");

    // 13. Priority score formula on a known issue
    console.log(`\n[Check 13] Priority score formula verification`);
    const priorityTestRes = await fetch(`${BASE_URL}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "High priority pedestrian crossing issue",
        category: "Footpath",
        location: "Sector 21 Market",
        severity: "High", // Weight 3 -> 30
        latitude: 28.4800,
        longitude: 77.0500,
      }),
    });
    const priorityTestIssue = await priorityTestRes.json();
    // Formula: 3 * 10 + 1 * 2 + 0 = 32
    assert(priorityTestIssue.daysPending === 0, "New issue has daysPending = 0");
    assert(priorityTestIssue.priorityScore === 32, "Priority score formula correctly computed: 3*10 + 1*2 + 0 = 32");

    // 14. GET /api/dashboard shape and totals
    console.log(`\n[Check 14] GET /api/dashboard payload shape and totals`);
    const dashboardRes = await fetch(`${BASE_URL}/dashboard`);
    const dashboard = await dashboardRes.json();
    assert(dashboardRes.status === 200, "GET /api/dashboard returns 200 OK");
    assert(typeof dashboard.totals?.total === "number", "Dashboard has totals.total");
    assert(typeof dashboard.totals?.pending === "number", "Dashboard has totals.pending");
    assert(typeof dashboard.totals?.inProgress === "number", "Dashboard has totals.inProgress");
    assert(typeof dashboard.totals?.resolved === "number", "Dashboard has totals.resolved");
    assert(dashboard.totals.total === dashboard.totals.pending + dashboard.totals.inProgress + dashboard.totals.resolved, "Totals sum equals total count");

    const expectedCategories = ["Streetlight", "Footpath", "Public Transport", "Road Damage", "Accessibility", "Other"];
    const hasAllCategories = expectedCategories.every((cat) => typeof dashboard.byCategory?.[cat] === "number");
    assert(hasAllCategories, "Dashboard contains counts for all 6 categories (including zeros)");

    const expectedSeverities = ["High", "Medium", "Low"];
    const hasAllSeverities = expectedSeverities.every((sev) => typeof dashboard.bySeverity?.[sev] === "number");
    assert(hasAllSeverities, "Dashboard contains counts for all 3 severities");

    // 15. Ranked list in dashboard excludes Resolved issues and is sorted descending
    console.log(`\n[Check 15] Dashboard ranked list rules`);
    assert(Array.isArray(dashboard.ranked), "Dashboard has ranked array");
    const noResolvedInRanked = dashboard.ranked.every((i) => i.status !== "Resolved");
    assert(noResolvedInRanked, "Ranked list strictly excludes Resolved issues");

    let isSortedDescending = true;
    for (let idx = 0; idx < dashboard.ranked.length - 1; idx++) {
      if (dashboard.ranked[idx].priorityScore < dashboard.ranked[idx + 1].priorityScore) {
        isSortedDescending = false;
        break;
      }
    }
    assert(isSortedDescending, "Ranked list is sorted by priorityScore descending");

    // 16. Hotspots ignore issues with null coordinates
    console.log(`\n[Check 16] Hotspots ignore issues without coordinates`);
    assert(Array.isArray(dashboard.hotspots), "Dashboard has hotspots array");
    const allHotspotsHaveCoords = dashboard.hotspots.every(
      (h) => typeof h.latitude === "number" && typeof h.longitude === "number" && typeof h.count === "number"
    );
    assert(allHotspotsHaveCoords, "Hotspots array only groups issues with valid coordinates");
    assert(dashboard.hotspots.length <= 5, "Hotspots contains at most top 5 areas");

  } catch (error) {
    console.error("\n❌ Fatal error during verification run:", error.message);
    failedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`  VERIFICATION RESULTS: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`======================================================\n`);

  process.exit(failedCount > 0 ? 1 : 0);
}

runVerification();
