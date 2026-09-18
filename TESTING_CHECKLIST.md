# TE CONNECT — Testing Checklist

This is the complete list of things to test before the app goes live.

## Setup Tests
- [ ] 1. Created Google Spreadsheet named "TE CONNECT DATABASE"
- [ ] 2. Ran `setupSpreadsheet()` in Apps Script
- [ ] 3. Verified all 10 tabs created: USERS, DEALERS, CONTRACTORS, SLABS, SALES, ACTIVE_TRACKER, MEETINGS, TARGETS, SETTINGS, ACTIVITY_LOG
- [ ] 4. Added a test user in USERS tab
- [ ] 5. Deployed Apps Script as Web App
- [ ] 6. Placed Web App URL in `src/config/api.ts`
- [ ] 7. Tested connection: opened `?action=getSettings` in browser — got JSON response

## Authentication Tests
- [ ] 8. Login with correct credentials — should succeed
- [ ] 9. Login with wrong password — should show error
- [ ] 10. Login with inactive user (`active = FALSE`) — should be rejected
- [ ] 11. Logout — should return to login screen
- [ ] 12. Restart app after logout — should stay on login screen
- [ ] 13. Restart app when logged in — should go directly to Home

## Dealer Tests
- [ ] 14. Added dealer in DEALERS tab with dealer_id, name, area, assigned_te
- [ ] 15. Generated QR for dealer (via Admin screen or Google Sheet `generateDealerQR` action)
- [ ] 16. Dealer QR shows correctly in the app (Admin > Dealer > QR)
- [ ] 17. Opened dealer QR link in a browser — showed slab form with dealer name pre-filled

## Slab Tests
- [ ] 18. Added slab from app (Add Slab form)
- [ ] 19. Verified slab appears in SLABS sheet in Google Sheets
- [ ] 20. Verified slab appears in calendar on the correct date
- [ ] 21. Opened dealer QR form, submitted slab — verified source = DEALER_QR in sheet
- [ ] 22. Updated slab status to COMPLETED — verified in sheet
- [ ] 23. Updated slab status to CANCELLED — verified in sheet
- [ ] 24. Used "Use Current Location" button — verified lat/long saved in sheet

## Sales Tests
- [ ] 25. Added sale entry (Add Sale form)
- [ ] 26. Verified sale appears in SALES sheet
- [ ] 27. Verified total MT calculated correctly on Sales screen
- [ ] 28. Verified F2R bags and GOLD bags shown separately
- [ ] 29. Added punch (Add Punch)
- [ ] 30. Verified punch appears in ACTIVE_TRACKER sheet
- [ ] 31. Verified Active % calculated correctly: (Punch / Total Sales) × 100
- [ ] 32. Verified Required Punch = Total Sales × Active Target %
- [ ] 33. Verified Dealer-wise sales table loads and shows correct data
- [ ] 34. Verified Team Active % section shows all TEs

## Meeting Tests
- [ ] 35. Added meeting from app
- [ ] 36. Verified meeting appears in MEETINGS sheet
- [ ] 37. Verified meeting appears in calendar on the correct date
- [ ] 38. Marked meeting as Completed (with outcome and people count)
- [ ] 39. Verified Completed count updated in meeting target cards
- [ ] 40. Submitted public meeting (via public form link)
- [ ] 41. Verified public meeting appears in MEETINGS sheet with source = PUBLIC_LINK

## Public Links Tests
- [ ] 42. Opened `?action=page&page=quick` in browser — showed two buttons
- [ ] 43. Clicked "Add Slab" from quick page — showed slab form
- [ ] 44. Clicked "Add Meeting" from quick page — showed meeting form
- [ ] 45. Submitted from public slab form — verified in SLABS sheet
- [ ] 46. Submitted from public meeting form — verified in MEETINGS sheet

## Home Dashboard Tests
- [ ] 47. Home shows correct greeting (morning/afternoon/evening)
- [ ] 48. Today's Slabs count is correct
- [ ] 49. Today's Sales in MT is correct
- [ ] 50. Active % on home matches Sales screen
- [ ] 51. Dealer Leaderboard shows top dealers by sales
- [ ] 52. Upcoming Slabs shows future slabs
- [ ] 53. Pull to refresh works on Home

## UI/UX Tests
- [ ] 54. Red theme applied consistently (primary red #C91F2B)
- [ ] 55. 5 bottom tabs visible: Home, Slab, +, Sales, Meeting
- [ ] 56. + button opens FAB modal with 3 options
- [ ] 57. All screens load without crash
- [ ] 58. Forms show validation errors when fields are missing
- [ ] 59. Success toast appears after adding slab/sale/meeting
- [ ] 60. Network error shown when offline

## Android Build Tests
- [ ] 61. `npm install` completes without errors
- [ ] 62. `npx expo prebuild` succeeds
- [ ] 63. APK builds successfully via `npm run build:apk`
- [ ] 64. APK installs on Android phone
- [ ] 65. App launches without crash
- [ ] 66. Login works on device
- [ ] 67. Add slab works on device (data appears in Google Sheet)
- [ ] 68. Calendar shows slab dates on device

---

✅ **All 68 tests passed = Ready for production use.**
