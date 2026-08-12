const header = document.querySelector('.header');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});

function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button');
  const originalText = btn.textContent;
  btn.textContent = 'Message Sent!';
  btn.style.background = 'linear-gradient(135deg, #7b6cf6, #5a4fcf)';
  form.reset();
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 3000);
}
