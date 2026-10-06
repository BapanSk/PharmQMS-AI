USE pharmqms;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE complaint_status_history;
TRUNCATE TABLE complaint_attachments;
TRUNCATE TABLE complaint_comments;
TRUNCATE TABLE complaint_investigations;
TRUNCATE TABLE complaint_ai_analysis;
TRUNCATE TABLE complaints;
TRUNCATE TABLE products;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES
(1, 'Elena Vasquez', 'admin@pharmqms.com', '$2b$12$hQZCfbL43Lco9qgPTv91YuU8t6YJoNoy0.WhAmMG5dOLFy2Y2pYKe', 'ADMIN', 1),
(2, 'Marcus Chen', 'manager@pharmqms.com', '$2b$12$hQZCfbL43Lco9qgPTv91YuU8t6YJoNoy0.WhAmMG5dOLFy2Y2pYKe', 'QA_MANAGER', 1),
(3, 'Priya Nair', 'qa@pharmqms.com', '$2b$12$hQZCfbL43Lco9qgPTv91YuU8t6YJoNoy0.WhAmMG5dOLFy2Y2pYKe', 'QA_ANALYST', 1);

INSERT INTO products (id, product_name, product_code, manufacturer, description, is_active) VALUES
(1, 'Nexacor 250 mg Tablets', 'NCL-250', 'Northvale Laboratories', 'Film-coated tablets indicated for simulated hypertension studies. Fictional product for PharmQMS training.', 1),
(2, 'Helioxin 500 mg Capsules', 'HLX-500', 'Helios Pharma Ltd', 'Hard gelatin capsules used in fictional infection-control quality scenarios.', 1),
(3, 'Ventrisol Inhalation Solution 2 mg/mL', 'VTS-2INH', 'Aether Respiratory Inc', 'Unit-dose nebules for simulated respiratory quality complaints.', 1),
(4, 'Calmidra 10 mg/mL Oral Suspension', 'CMD-10OS', 'Lumina Formulations', 'Banana-flavored oral suspension used in packaging and labeling training cases.', 1),
(5, 'Ostevia 70 mg Weekly Tablets', 'OSV-70W', 'Summit Bone Health', 'Once-weekly tablets for fictional bone-health complaint workflows.', 1);

INSERT INTO complaints (
  id, complaint_id, customer_name, customer_email, customer_phone, product_id,
  batch_number, manufacturing_date, expiry_date, category, description,
  purchase_location, country, severity, priority, status, assigned_to
) VALUES
(1, 'PHQ-2026-000001', 'Aisha Rahman', 'aisha.rahman@example.com', '+1-555-0107', 1,
 'NCL-250-A12', '2025-11-02', '2027-11-02', 'Product Quality',
 'Several tablets in a newly opened bottle were cracked and had a bitter chemical odor not typical of previous supplies.',
 'Northside Pharmacy', 'Canada', 'Major', 'High', 'New', 3),
(2, 'PHQ-2026-000002', 'Daniel Okonkwo', 'daniel.okonkwo@example.com', '+1-555-0142', 2,
 'HLX-500-B07', '2025-08-18', '2027-08-18', 'Packaging',
 'Bottle seal was broken on arrival and two capsules were missing from the labeled count of 30.',
 'Harbor Community Clinic', 'United States', 'Major', 'High', 'QA Review', 3),
(3, 'PHQ-2026-000003', 'Sofia Alvarez', 'sofia.alvarez@example.com', '+34-611-555-019', 4,
 'CMD-10OS-C03', '2025-09-09', '2026-09-09', 'Labeling',
 'Carton listed a 5 mg/mL strength while the bottle label correctly stated 10 mg/mL.',
 'Farmacia del Sol', 'Spain', 'Critical', 'High', 'Under Investigation', 2),
(4, 'PHQ-2026-000004', 'James Whitaker', 'james.whitaker@example.com', '+44-20-5550-1188', 3,
 'VTS-2INH-D21', '2025-06-30', '2026-12-30', 'Adverse Event',
 'Patient reported wheezing within minutes of a routine dose. Product was retained for investigation. No real patient identifiers included.',
 'Thames Respiratory Center', 'United Kingdom', 'Critical', 'High', 'AI Analyzed', 2),
(5, 'PHQ-2026-000005', 'Mei Lin', 'mei.lin@example.com', '+65-6555-0144', 5,
 'OSV-70W-E09', '2025-10-12', '2027-10-12', 'Distribution',
 'Shipment arrived 14 hours outside the documented temperature range according to the logger in the tote.',
 'Pacific Wholesale Depot', 'Singapore', 'Major', 'Medium', 'Corrective Action', 3),
(6, 'PHQ-2026-000006', 'Omar Haddad', 'omar.haddad@example.com', '+971-4-555-2201', 1,
 'NCL-250-F04', '2025-07-21', '2027-07-21', 'Manufacturing',
 'Tablet color varied from pale peach to dark orange within the same bottle.',
 'Al Noor Medical Store', 'United Arab Emirates', 'Minor', 'Medium', 'Resolved', 2),
(7, 'PHQ-2026-000007', 'Claire Dubois', 'claire.dubois@example.com', '+33-1-5555-7730', 2,
 'HLX-500-G18', '2025-12-01', '2027-12-01', 'Other',
 'Customer reported difficulty opening the child-resistant cap after a recent packaging supplier change.',
 'Pharmacie Saint-Michel', 'France', 'Minor', 'Low', 'Closed', 3),
(8, 'PHQ-2026-000008', 'Hiroshi Tanaka', 'hiroshi.tanaka@example.com', '+81-3-5550-4488', 3,
 'VTS-2INH-H11', '2026-01-15', '2027-07-15', 'Product Quality',
 'Two nebules in a 10-count carton contained visible particulates after gentle swirling.',
 'Kanda Clinic Pharmacy', 'Japan', 'Critical', 'High', 'Under Investigation', 3),
(9, 'PHQ-2026-000009', 'Lina Bergstrom', 'lina.bergstrom@example.com', '+46-8-555-9012', 4,
 'CMD-10OS-J02', '2025-05-08', '2026-05-08', 'Packaging',
 'Oral syringe included in the carton did not match the 5 mL graduation shown in the patient leaflet.',
 'Nordic Family Pharmacy', 'Sweden', 'Major', 'Medium', 'QA Review', NULL),
(10, 'PHQ-2026-000010', 'Robert Ellis', 'robert.ellis@example.com', '+1-555-0188', 5,
 'OSV-70W-K16', '2026-02-03', '2028-02-03', 'Labeling',
 'Blister foil printed the weekly dosing day as Tuesday while the carton and leaflet state Thursday.',
 'Lakeside Health Mart', 'United States', 'Minor', 'Low', 'New', NULL);

INSERT INTO complaint_status_history (complaint_pk, from_status, to_status, changed_by, notes) VALUES
(1, NULL, 'New', 2, 'Complaint created from intake form'),
(2, NULL, 'New', 2, 'Complaint created from intake form'),
(2, 'New', 'QA Review', 2, 'Assigned to QA analyst for packaging review'),
(3, NULL, 'New', 1, 'Complaint created from intake form'),
(3, 'New', 'AI Analyzed', 2, 'Preliminary labeling mismatch flagged'),
(3, 'AI Analyzed', 'Under Investigation', 2, 'Opened investigation for carton/bottle strength mismatch'),
(4, NULL, 'New', 2, 'Complaint created from intake form'),
(4, 'New', 'AI Analyzed', 2, 'Adverse event pathway initiated'),
(5, NULL, 'New', 2, 'Complaint created from intake form'),
(5, 'New', 'QA Review', 2, 'Cold-chain logger data requested'),
(5, 'QA Review', 'Under Investigation', 3, 'Temperature excursion confirmed'),
(5, 'Under Investigation', 'Corrective Action', 2, 'Carrier CAPA requested'),
(6, NULL, 'New', 2, 'Complaint created from intake form'),
(6, 'New', 'Under Investigation', 2, 'Color variation sample retained'),
(6, 'Under Investigation', 'Resolved', 2, 'Within specification; customer notified'),
(7, NULL, 'New', 3, 'Complaint created from intake form'),
(7, 'New', 'QA Review', 3, 'Cap supplier change reviewed'),
(7, 'QA Review', 'Resolved', 2, 'Use instruction added to pack'),
(7, 'Resolved', 'Closed', 2, 'No further action required'),
(8, NULL, 'New', 2, 'Complaint created from intake form'),
(8, 'New', 'Under Investigation', 3, 'Particulate samples quarantined'),
(9, NULL, 'New', 2, 'Complaint created from intake form'),
(9, 'New', 'QA Review', 2, 'Device/leaflet mismatch queued for artwork review'),
(10, NULL, 'New', 2, 'Complaint created from intake form');

INSERT INTO complaint_comments (complaint_pk, user_id, comment) VALUES
(2, 3, 'Requested remaining units from the clinic for physical inspection.'),
(3, 2, 'Artwork versions for carton CMD-10OS-C03 and bottle label do not match.'),
(8, 3, 'Quarantined remaining cartons from batch VTS-2INH-H11.');

INSERT INTO complaint_investigations (
  complaint_pk, investigator_id, root_cause, findings, capa_actions, investigation_status, started_at, completed_at
) VALUES
(3, 2, NULL, 'Carton artwork revision C03 used an outdated strength statement.', NULL, 'In Progress', '2026-03-12 09:00:00', NULL),
(5, 3, 'Carrier cooler pack was underfilled for a 36-hour lane.', 'Logger showed 14-hour excursion above 8C.', 'Update packing SOP and carrier qualification.', 'In Progress', '2026-03-18 11:30:00', NULL),
(6, 2, 'Acceptable coating color range; no process drift identified.', 'Retain samples matched batch record photographs.', 'No CAPA required.', 'Completed', '2026-02-20 08:15:00', '2026-03-01 16:40:00');

INSERT INTO complaint_ai_analysis (
  complaint_pk, summary, suggested_severity, suggested_priority, suggested_category, risk_score, recommendations, model_name
) VALUES
(4, 'Possible respiratory adverse event associated with inhalation solution. Escalate for clinical review.', 'Critical', 'High', 'Adverse Event', 92.50, 'Preserve remaining nebules, collect lot genealogy, notify pharmacovigilance workflow.', 'pharmqms-demo-analyzer'),
(3, 'Strength mismatch between carton and bottle is a labeling control failure with patient dosing risk.', 'Critical', 'High', 'Labeling', 88.00, 'Quarantine remaining finished goods and compare artwork versions.', 'pharmqms-demo-analyzer');
