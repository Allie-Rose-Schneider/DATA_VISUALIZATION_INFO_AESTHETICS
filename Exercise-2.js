// Children's TV on Netflix, "What We Watched" Jan to Jun 2025
// Toggle 1: roll up to one bar per SHOW, or break out by SEASON
// Toggle 2: measure VIEWS or HOURS VIEWED

async function main() {
  const app = d3.select('#app')

  // ---- PRE-FILLED: load the data --------------------------------------
  // The ../ goes up one folder, from starter-files to 06_netflix-added.
  const raw = await d3.csv('../data/NetflixTV_added.csv')
  console.log('raw rows', raw)

  // ---- CLEANING THE DATA -----------------------------------------------

// manual fix -- show with missing languge
const language_fixes = {
  'Grizzy and the Lemmings': 'French',
}

const shows = raw.map((d) => {
  const show = d.Simple_Title_Clean
  return {
    show: show,
    season: d.net_season,
    views: +d.Views,
    hours: +d['Hours Viewed'],
    release_date: d['Release Date'],
    genres: parseGenres(d.genres),
    language: d.language || language_fixes[show] || 'Unknown',
  }
})

console.log('clean shows', shows)




// ---- FILTER: children's shows only ----------------------------------------
  const kids = shows.filter((d) => d.genres.includes ('Children'))
  console.log('kids rows', kids.length, kids.slice(0, 10))


// check -- handling multiple seasons
    const dupes = Array.from(
    d3.rollup(kids, (v) => v.length, (d) => d.show, (d) => d.season),
    ([show, seasons]) => Array.from(seasons, ([season, n]) => ({ show, season, n }))
  )
    .flat()
    .filter((d) => d.n > 1)
  console.log('show+season combos with more than one row', dupes)

 // ---- SETTINGS ---------------------------------------------------------------
  
 // what is currently selected??
  const state = { level: 'show', measure: 'views' }
 
    // lookup tables -- need to remember what is selected
  const measures = {
    views: { button: 'Views', axis: 'Total views (millions)', key: 'views' },
    hours: { button: 'Hours viewed', axis: 'Total hours viewed (millions)', key: 'hours' },
  }

  const fmt = (n) => d3.format(',.1~f')(n / 1e6) + 'M' // turns raw number into short text for axis
 
// ---- COLOR BY LANGUAGE ---------------
  const language_of = new Map(kids.map((d) => [d.show, d.language]))

  const color_scale = d3
    .scaleOrdinal()
    .domain(Array.from(new Set(kids.map((d) => d.language))))
    .range(d3.schemeBlues[5].slice(1).reverse())

  console.log('languages', color_scale.domain())


  // ---- DISPLAY ------------------------------------------------------------------
  // drawing space
  const W = 760
  const H = 420
  const margin = { top: 76, right: 70, bottom: 50, left: 200 } // need some space for words 

  // create container to hold the buttons
  const controls = app.append('div').style('margin-bottom', '8px')
  // make the buttons
  const measure_buttons = controls
    .selectAll('button')
    .data(Object.keys(measures))
    .join('button')
    .text((k) => measures[k].button)
    .style('margin-right', '6px')
    .style('padding', '4px 10px')
    .style('cursor', 'pointer')
    .style('border-radius', '12px')
    .on('click', (event, k) => {
      state.measure = k
      update()
    })

 
  const svg = d3
    .create('svg')
    .attr('viewBox', [0, 0, W, H])
    .style('border', '1px solid gray')
    .style('max-width', '100%')
 
  svg
    .append('text')
    .attr('x', 12)
    .attr('y', 24)
    .style('font-size', '16px')
    .style('font-weight', 'bold')
    .text("Most-watched children's series on Netflix")

  const subtitle = svg
    .append('text')
    .attr('x', 12)
    .attr('y', 42)
    .style('font-size', '11px')
    .attr('fill', '#555')
 
  // ---- LEGEND (inside the SVG, in the top margin) ---------------------------------
    svg
      .append('text')
      .attr('x', 12)
      .attr('y', 62)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .text('Language:')
    const legend_g = svg.append('g').attr('transform', 'translate(80, 62)')
  
    const x_axis_g = svg.append('g').attr('transform', `translate(0, ${H - margin.bottom})`)
    const bars_g = svg.append('g')
  
    const y_scale = d3.scaleBand().range([margin.top, H - margin.bottom]).padding(0.15)
    const x_scale = d3.scaleLinear().range([margin.left, W - margin.right])
    
  // ---- BUILD THE ROWS -------------------------------------
  function getRows() {
    const key = measures[state.measure].key
    const total = (v) => d3.sum(v, (d) => d[key])
 
    if (state.level === 'show') {
      // one number per show, all seasons added together
      return d3
        .rollups(kids, total, (d) => d.show)
        .map(([show, value]) => ({ show, label: show, value }))
    }
    // one number per show + season
    return d3
    // take the rows, group by show, then group again by season inside the show
      .rollups(kids, total, (d) => d.show, (d) => d.season)
    
      .flatMap(([show, seasons]) =>
        seasons.map(([season, value]) => ({
          show,
          label: season ? `${show} S${season}` : show,
          value,
        }))
      )
  }

  // ---- UPDATE ----------------------------------------------------------------------
  // runs once at the start and once every time a button is clicked 

  function update() {
    const m = measures[state.measure]
    const top = getRows()
      .sort((a, b) => d3.descending(a.value, b.value))
      .slice(0, 10)
    console.log(state, top)
 
    y_scale.domain(top.map((d) => d.label))
    x_scale.domain([0, d3.max(top, (d) => d.value)]).nice()
 
    subtitle.text(`${m.axis}, Jan to Jun 2025`)
    measure_buttons.style('font-weight', (k) => (k === state.measure ? 'bold' : 'normal'))
 
    // legend: only the languages in the current top 10
    const langs = Array.from(new Set(top.map((d) => language_of.get(d.show))))
    legend_g
      .selectAll('g.item')
      .data(langs, (d) => d)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'item')
        g.append('rect')
          .attr('y', -5)
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', (d) => color_scale(d))
        g.append('text')
          .attr('x', 14)
          .attr('dominant-baseline', 'middle')
          .style('font-size', '11px')
          .text((d) => d)
        return g
      })
      .attr('transform', (d, i) => `translate(${i * 90}, 0)`)
 
    const t = svg.transition().duration(600)
    x_axis_g.transition(t).call(d3.axisBottom(x_scale).ticks(5).tickFormat(fmt))
 
    bars_g
      .selectAll('g.bar')
      .data(top, (d) => d.label)
      .join((enter) => {
        
        const g = enter
          .append('g')
          .attr('class', 'bar')
          .attr('transform', (d) => `translate(0, ${y_scale(d.label)})`)
        
          g.append('rect')
          .attr('x', x_scale(0))
          .attr('width', 0)
          .attr('height', y_scale.bandwidth())
          .attr('fill', (d) => color_scale(language_of.get(d.show)))
        
          g.append('text')
          .attr('class', 'name')
          .attr('x', margin.left - 8)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '12px')
          .text((d) => (d.label.length > 28 ? d.label.slice(0, 27) + '…' : d.label))
        
          g.append('text')
          .attr('class', 'value')
          .attr('x', x_scale(0) + 6)
          .attr('dominant-baseline', 'middle')
          .style('font-size', '12px')
        
          g.append('title')
        return g
      })
      .call((g) => {
        g.transition(t).attr('transform', (d) => `translate(0, ${y_scale(d.label)})`)
        g.select('rect')
          .transition(t)
          .attr('height', y_scale.bandwidth())
          .attr('width', (d) => x_scale(d.value) - x_scale(0))
        g.selectAll('text.name, text.value').attr('y', y_scale.bandwidth() / 2)
        g.select('text.value')
          .text((d) => fmt(d.value))
          .transition(t)
          .attr('x', (d) => x_scale(d.value) + 6)
        g.select('title').text((d) => `${d.label}: ${fmt(d.value)}`)
      })
  }
 
  app.append(() => svg.node())
  update()
}
 
// ---- HELPER ---------------------------------------------------------------------------
// Turns "('Children', 'Comedy')" or "Children,Comedy" into ["Children", "Comedy"]
function parseGenres(text) {
  if (!text) return []
  return text
    .replace(/[()\[\]'"]/g, '')
    .split(',')
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0 && genre !== '\\N')
}
 
main()
 