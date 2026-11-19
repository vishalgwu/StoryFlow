// Keep native wheel/touch scrolling. Only section navigation uses browser smooth scrolling.
export function createNavigation() {
  const nav = document.querySelector('.studio-nav'), dock = document.querySelector('.writing-dock');
  const footer = document.querySelector('.workspace footer'), root = document.documentElement;
  const links = [...nav.querySelectorAll('a')], sections = links.map(link => document.querySelector(link.hash));
  let frame = 0;
  function measure() {
    const navHeight = nav.getBoundingClientRect().height, footerHeight = footer.getBoundingClientRect().height, dockHeight = dock.getBoundingClientRect().height;
    // Enlarged text or a short viewport must not leave a sliver between two fixed bars.
    const occupied = navHeight + footerHeight + dockHeight;
    const flow = occupied > innerHeight * (root.classList.contains('flow-controls') ? .35 : .48);
    root.classList.toggle('flow-controls', flow);
    root.style.setProperty('--nav-height', `${flow ? 0 : navHeight}px`);
    root.style.setProperty('--footer-height', `${flow ? 0 : footerHeight}px`);
    root.style.setProperty('--dock-clearance', `${flow ? 24 : dockHeight + footerHeight + 24}px`);
  }
  function update() {
    frame = 0;
    const line = Math.max(0, nav.getBoundingClientRect().bottom) + 48;
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
  addEventListener('resize', () => { measure(); schedule(); }, { passive: true });
  measure(); update();
}
