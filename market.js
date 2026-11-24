"use strict";

const search = document.getElementById("search");
const views = document.getElementById("market-views");
const filters = document.getElementById("filters");
const grid = document.getElementById("skill-grid");
const empty = document.getElementById("empty");
const reset = document.getElementById("reset");
const refresh = document.getElementById("refresh");
const notice = document.getElementById("notice");
const dialog = document.getElementById("skill-detail");
const detailBody = document.getElementById("detail-body");
const channels = new Map([["stable", "正式版"], ["preview", "预览版"], ["dev", "开发版"]]);
const skillIcons = new Set(["scan", "receipt", "compare", "chart", "building", "shield", "clipboard"]);
const iconColors = new Set(["blue", "teal", "violet", "cyan", "amber", "rose", "indigo"]);

let skills;
let activeCategory = "";
let marketView = "all";
let detailTrigger;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function skillIcon(skill) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNamespace, "svg");
  const use = document.createElementNS(svgNamespace, "use");
  use.setAttribute("href", `./market-icons.svg#${skillIcons.has(skill.icon) ? skill.icon : "package"}`);
  icon.append(use);
  const wrapper = node("span", "sc-skill-icon");
  if (iconColors.has(skill.color)) wrapper.classList.add(skill.color);
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.append(icon);
  return wrapper;
}

function timeLabel(date) {
  const label = node("time", "", date);
  label.dateTime = date;
  return label;
}

function renderFilters() {
  const categories = [...new Set(skills.map((skill) => skill.category))];
  if (!categories.includes(activeCategory)) activeCategory = "";
  filters.replaceChildren(...["", ...categories].map((category) => {
    const button = node("button", "", category || "全部分类");
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    return button;
  }));
}

function renderMarket() {
  if (!skills) return;
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const displayed = skills.filter((skill) => {
    if (activeCategory && skill.category !== activeCategory) return false;
    const content = `${skill.name} ${skill.tagline} ${skill.description} ${skill.category} ${skill.id} ${skill.example?.title ?? ""}`.toLowerCase();
    return terms.every((term) => content.includes(term));
  });
  if (marketView === "recent") {
    displayed.sort((a, b) => b.releasedOn.localeCompare(a.releasedOn));
  }
  for (const button of filters.children) {
    button.setAttribute("aria-pressed", String(button.dataset.category === activeCategory));
  }
  document.getElementById("result-count").textContent = `共 ${displayed.length} 项技能`;
  empty.hidden = displayed.length > 0;
  reset.hidden = skills.length === 0;
  document.getElementById("empty-title").textContent = skills.length ? "没有匹配的技能" : "技能目录暂无展示内容";
  document.getElementById("empty-message").textContent = skills.length ? "试试其他关键词，或清除当前筛选。" : "新技能发布后会显示在这里。";
  grid.replaceChildren(...displayed.map((skill) => {
    const card = node("article", "sc-skill-card");
    const body = node("div", "sc-card-body");
    const header = node("div", "sc-card-heading");
    const labels = node("div", "");
    labels.append(node("h2", "", skill.name), node("span", "", skill.category));
    header.append(skillIcon(skill), labels);
    const link = node("a", "sc-card-detail", "查看详情");
    link.href = `#skill/${encodeURIComponent(skill.id)}`;
    link.setAttribute("aria-label", `查看${skill.name}详情`);
    const meta = node("div", "sc-card-meta");
    const date = timeLabel(skill.releasedOn);
    date.className = "sc-card-date";
    meta.append(node("span", "sc-card-version", `v${skill.version}`), node("span", skill.channel === "stable" ? "sc-badge success" : "sc-badge", channels.get(skill.channel)), date);
    const footer = node("footer", "");
    footer.append(link);
    body.append(header, node("p", "sc-card-description", skill.tagline), meta);
    card.append(body, footer);
    return card;
  }));
}

function demo(example) {
  const section = node("section", "example");
  const heading = node("div", "example-heading");
  heading.append(node("h3", "", example.title), node("span", "example-label", "合成示例"));
  const prompt = node("div", "example-prompt");
  prompt.append(node("span", "", "示例提问"), node("p", "", example.input));
  const table = node("table", "example-table");
  table.append(node("caption", "sr-only", example.title));
  const header = table.createTHead().insertRow();
  for (const column of example.columns) {
    const cell = node("th", "", column);
    cell.scope = "col";
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of example.rows) {
    const tr = body.insertRow();
    for (const value of row) tr.append(node("td", "", value));
  }
  const tableWrap = node("div", "table-wrap");
  tableWrap.append(table);
  section.append(heading, prompt, node("p", "example-summary", example.summary), tableWrap);
  return section;
}

function syncDetail() {
  if (!location.hash.startsWith("#skill/")) {
    if (dialog.open) dialog.close();
    return;
  }
  if (!skills) return;
  const skill = skills.find((item) => `#skill/${encodeURIComponent(item.id)}` === location.hash);
  const title = node("h2", "detail-title", skill?.name ?? "此技能暂未展示");
  title.id = "detail-title";
  if (skill) {
    const header = node("div", "detail-header");
    const heading = node("div", "");
    heading.append(node("p", "card-category", skill.category), title);
    header.append(skillIcon(skill), heading);
    const meta = node("div", "detail-meta");
    meta.append(node("span", "channel", channels.get(skill.channel)), node("span", "version", `v${skill.version}`), timeLabel(skill.releasedOn));
    detailBody.replaceChildren(header, meta, node("p", "detail-description", skill.description));
    if (skill.example) detailBody.append(demo(skill.example));
  } else {
    detailBody.replaceChildren(title, node("p", "detail-description", "请返回技能目录查看当前已发布的展示内容。"));
  }
  if (!dialog.open) {
    detailTrigger = document.activeElement;
    dialog.showModal();
  }
}

async function loadCatalog() {
  if (refresh.disabled) return;
  refresh.disabled = true;
  notice.hidden = false;
  notice.textContent = skills ? "正在刷新目录…" : "正在读取技能目录…";
  try {
    const response = await fetch("./catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`目录响应 ${response.status}`);
    const catalog = await response.json();
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.skills)) throw new Error("目录格式错误");
    const latest = catalog.skills.map((skill) => skill.releasedOn).sort().at(-1);
    const dateLabel = document.getElementById("catalog-date");
    dateLabel.replaceChildren();
    if (latest) dateLabel.append("最近发行 ", timeLabel(latest));
    skills = catalog.skills;
    renderFilters();
    renderMarket();
    syncDetail();
    notice.hidden = true;
  } catch {
    notice.textContent = skills ? "暂时无法刷新，当前仍显示上次读取的目录。请稍后重试。" : "暂时无法读取技能目录。请点击「刷新目录」重试。";
  } finally {
    refresh.disabled = false;
  }
}

search.addEventListener("input", renderMarket);
views.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  marketView = button.dataset.view;
  for (const view of views.children) {
    view.setAttribute("aria-pressed", String(view === button));
  }
  renderMarket();
});
filters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderMarket();
});
reset.addEventListener("click", () => {
  activeCategory = "";
  search.value = "";
  renderMarket();
  search.focus();
});
document.getElementById("search-shortcut").textContent = navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K";
document.addEventListener("keydown", (event) => {
  if (!dialog.open && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
  }
});
refresh.addEventListener("click", loadCatalog);
window.addEventListener("hashchange", syncDetail);
document.getElementById("close-detail").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  if (location.hash.startsWith("#skill/")) history.replaceState(null, "", "#market");
  if (detailTrigger instanceof HTMLElement && detailTrigger !== document.body && detailTrigger.isConnected) {
    detailTrigger.focus();
  }
});
loadCatalog();
