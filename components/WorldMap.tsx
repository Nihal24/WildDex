import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Continent } from '../utils/claude';
import { COLORS } from '../constants/theme';

// Continent name → ISO continent code used in Natural Earth data
const CONTINENT_MAP: Record<Continent, string> = {
  'Africa':        'Africa',
  'Antarctica':    'Antarctica',
  'Asia':          'Asia',
  'Europe':        'Europe',
  'North America': 'North America',
  'Oceania':       'Oceania',
  'South America': 'South America',
};

interface Props {
  highlightedContinents: Continent[];
}

export const WorldMap: React.FC<Props> = ({ highlightedContinents }) => {
  const highlighted = highlightedContinents.map((c) => CONTINENT_MAP[c]);
  const highlightedJson = JSON.stringify(highlighted);
  const primaryColor = COLORS.primary;   // e.g. '#e53935'
  const yellowColor  = COLORS.yellow;    // e.g. '#FFD600'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #0a1628; overflow: hidden; }
  svg { display: block; width: 100%; height: 100%; }
  .land { fill: #1e3a52; stroke: #1e3a52; stroke-width: 0.5; }
  .land.highlighted { fill: ${primaryColor}; stroke: ${primaryColor}; stroke-width: 0.5; }
  .graticule { fill: none; stroke: #122030; stroke-width: 0.3; }
  .sphere { fill: #0a1628; }
</style>
</head>
<body>
<svg id="map"></svg>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
const highlighted = ${highlightedJson};

const w = window.innerWidth;
const h = window.innerHeight;

const svg = d3.select('#map')
  .attr('width', w)
  .attr('height', h);

const projection = d3.geoNaturalEarth1()
  .scale(w / 6.2)
  .translate([w / 2, h / 2]);

const path = d3.geoPath().projection(projection);

// Sphere (ocean)
svg.append('path')
  .datum({ type: 'Sphere' })
  .attr('class', 'sphere')
  .attr('d', path);

// Graticule
svg.append('path')
  .datum(d3.geoGraticule()())
  .attr('class', 'graticule')
  .attr('d', path);

// Load world atlas
fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(r => r.json())
  .then(world => {
    const countries = topojson.feature(world, world.objects.countries);

    // Country → continent mapping via numeric ISO codes
    // Source: UN M49 / Natural Earth continent field
    const continentOf = {
      "004":"Asia","008":"Europe","012":"Africa","024":"Africa","031":"Asia",
      "032":"South America","036":"Oceania","040":"Europe","050":"Asia",
      "051":"Asia","056":"Europe","064":"Asia","068":"South America",
      "070":"Europe","072":"Africa","076":"South America","084":"North America",
      "086":"Asia","090":"Oceania","096":"Asia","100":"Europe","104":"Asia",
      "108":"Africa","112":"Europe","116":"Asia","120":"Africa","124":"North America",
      "132":"Africa","140":"Africa","144":"Asia","148":"Africa","152":"South America",
      "156":"Asia","170":"South America","174":"Africa","175":"Africa","178":"Africa",
      "180":"Africa","188":"North America","191":"Europe","192":"North America",
      "196":"Asia","203":"Europe","204":"Africa","208":"Europe","214":"North America",
      "218":"South America","818":"Africa","222":"North America","226":"Africa",
      "231":"Africa","232":"Africa","233":"Europe","246":"Europe","250":"Europe",
      "266":"Africa","270":"Africa","288":"Africa","292":"Europe","308":"North America",
      "320":"North America","324":"Africa","328":"South America","332":"North America",
      "340":"North America","348":"Europe","356":"Asia","360":"Asia","364":"Asia",
      "368":"Asia","372":"Europe","376":"Asia","380":"Europe","384":"Africa",
      "388":"North America","392":"Asia","400":"Asia","398":"Asia","404":"Africa",
      "408":"Asia","410":"Asia","414":"Asia","417":"Asia","418":"Asia",
      "422":"Asia","426":"Africa","428":"Europe","430":"Africa","434":"Africa",
      "440":"Europe","442":"Europe","450":"Africa","454":"Africa","458":"Asia",
      "466":"Africa","470":"Europe","478":"Africa","484":"North America","496":"Asia",
      "504":"Africa","508":"Africa","516":"Africa","524":"Asia","528":"Europe",
      "540":"Oceania","558":"North America","562":"Africa","566":"Africa","570":"Oceania",
      "578":"Europe","586":"Asia","591":"North America","598":"Oceania","600":"South America",
      "604":"South America","608":"Asia","616":"Europe","620":"Europe","630":"North America",
      "634":"Asia","642":"Europe","643":"Europe","646":"Africa","682":"Asia",
      "686":"Africa","694":"Africa","703":"Europe","706":"Africa","710":"Africa",
      "716":"Africa","724":"Europe","729":"Africa","740":"South America","752":"Europe",
      "756":"Europe","760":"Asia","762":"Asia","764":"Asia","768":"Africa",
      "780":"North America","788":"Africa","792":"Asia","795":"Asia","800":"Africa",
      "804":"Europe","784":"Asia","826":"Europe","834":"Africa","840":"North America",
      "858":"South America","860":"Asia","862":"South America","887":"Asia",
      "894":"Africa","248":"Europe","010":"Antarctica","036":"Oceania","554":"Oceania"
    };

    svg.selectAll('.land')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('class', d => {
        const c = continentOf[String(d.id)];
        return 'land' + (c && highlighted.includes(c) ? ' highlighted' : '');
      })
      .attr('d', path);
  })
  .catch(err => console.error('Failed to load map:', err));
</script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
      />
      {highlightedContinents.length > 0 && (
        <View style={styles.legend}>
          {highlightedContinents.map((continent) => (
            <View key={continent} style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>{continent}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  webview: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0a1628' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  legendText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
});
