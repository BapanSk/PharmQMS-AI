const express = require('express');
const complaintController = require('../controllers/complaintController');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();
const staff = [authenticate, authorize(ROLES.QA_MANAGER, ROLES.QA_ANALYST)];

router.post('/', optionalAuthenticate, complaintController.createComplaint);

router.get('/', ...staff, complaintController.listComplaints);

router.post('/:id/analyze', ...staff, complaintController.analyzeComplaint);
router.post('/:id/analyze/review', ...staff, complaintController.reviewAnalysis);

router.get('/:id/investigation', ...staff, complaintController.getInvestigation);
router.post('/:id/investigation', ...staff, complaintController.createInvestigation);
router.put('/:id/investigation', ...staff, complaintController.updateInvestigation);

router.get('/:id/comments', ...staff, complaintController.listComments);
router.post('/:id/comments', ...staff, complaintController.addComment);

router.get('/:id/history', ...staff, complaintController.getHistory);

router.post('/:id/attachments', ...staff, uploadSingle, complaintController.uploadAttachment);
router.get('/:id/attachments/:attachmentId', ...staff, complaintController.downloadAttachment);

router.get('/:id', ...staff, complaintController.getComplaint);
router.put('/:id', ...staff, complaintController.updateComplaint);

module.exports = router;
