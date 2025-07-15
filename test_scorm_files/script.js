// Test SCORM Course JavaScript
function completeLesson() {
    alert('Lesson completed! This would normally communicate with SCORM API.');
    console.log('SCORM lesson completion would be tracked here');
}

// Initialize when page loads
window.onload = function() {
    console.log('Test SCORM course loaded');
    
    // In a real SCORM course, this would initialize the SCORM API
    // doInitialize();
    
    // Track that the learner has accessed the content
    console.log('Learner accessed content - tracking would happen here');
};
