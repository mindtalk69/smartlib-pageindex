document.addEventListener('DOMContentLoaded', function () {
  const languageModalElement = document.getElementById('languageModal');
  if (!languageModalElement) {
    console.error('Language modal element not found!');
    return;
  }
  const languageModal = new bootstrap.Modal(languageModalElement);

  window.testShowLanguageModal = function() {
    console.log('Manually triggering language modal show');
    languageModal.show();
    setTimeout(() => {
      const style = window.getComputedStyle(languageModalElement);
      console.log('Modal display style:', style.display);
      console.log('Modal visibility style:', style.visibility);
      console.log('Modal opacity:', style.opacity);
      const backdrop = document.querySelector('.modal-backdrop');
      console.log('Modal backdrop present:', !!backdrop);
    }, 500);
  };

  console.log('Debug helper "testShowLanguageModal" added to window. Run testShowLanguageModal() in console to test modal display.');
});
