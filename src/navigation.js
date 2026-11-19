// Keep native wheel/touch scrolling. Only section navigation uses browser smooth scrolling.
export function createNavigation() {
  const nav = document.querySelector('.studio-nav'), dock = document.querySelector('.writing-dock');
  const footer = document.querySelector('.workspace footer'), root = document.documentElement;
  const links = [...nav.querySelectorAll('a')], sections = links.map(link => document.querySelector(link.hash));
  let frame = 0;
  function measure() {
    root.style.setProperty('--nav-height', `${nav.getBoundingClientRect().height}px`);
    root.style.setProperty('--footer-height', `${footer.getBoundingClientRect().height}px`);
    root.style.setProperty('--dock-clearance', `${dock.getBoundingClientRect().height + footer.getBoundingClientRect().height + 24}px`);
  }
  function update() {
    frame = 0;
    const line = nav.getBoundingClientRect().bottom + 48;
    let active = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= line) active = section;
    links.forEach(link => { if (link.hash === `#${active.id}`) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    const tools = sections[0].getBoundingClientRect().bottom <= line;
    dock.classList.toggle('tools-mode', tools);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  const observer = new ResizeObserver(() => { measure(); schedule(); });
  [nav, dock, footer].forEach(element => observer.observe(element));
  addEventListener('resize', schedule, { passive: true });
  measure(); update();
}
