    document.addEventListener('DOMContentLoaded', () => {
        // FAQ Accordion
        const faqQuestions = document.querySelectorAll('.faq-question');
        faqQuestions.forEach(question => {
            question.addEventListener('click', () => {
                const answer = question.nextElementSibling;
                const isOpen = answer.classList.contains('open');
                
                // Close all other open answers
                document.querySelectorAll('.faq-answer.open').forEach(openAnswer => {
                    if (openAnswer !== answer) {
                        openAnswer.classList.remove('open');
                        openAnswer.previousElementSibling.classList.remove('open');
                        openAnswer.style.paddingTop = '0';
                    }
                });

                // Toggle the clicked one
                answer.classList.toggle('open');
                question.classList.toggle('open');
                if (answer.classList.contains('open')) {
                    answer.style.paddingTop = '1rem';
                } else {
                    answer.style.paddingTop = '0';
                }
            });
        });

        // Fade-in Animation on Scroll
        const fadeInTargets = document.querySelectorAll('section, .step-card, .faq-item, footer, nav.toc, header');
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -10% 0px', // Trigger a bit early
            threshold: 0.1
        });

        fadeInTargets.forEach(target => {
            target.classList.add('fade-in-target');
            observer.observe(target);
        });
    });
