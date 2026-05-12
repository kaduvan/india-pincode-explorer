# India Pincode Explorer 🇮🇳

An interactive dashboard for exploring India's postal pincode boundaries, built with Leaflet.js.

![Dashboard Preview](https://img.shields.io/badge/Pincodes-19%2C312-blue) ![States](https://img.shields.io/badge/States%2FUTs-36-green)

## 🗺️ Features

- **Interactive Map** — Explore 19,312 pincode boundaries across India
- **State & Division Filters** — Drill down from country to state to division level
- **Pincode Search** — Type a pincode to instantly locate it on the map
- **Office Type Filter** — Filter by Head Office (H.O), Sub Office (S.O), or Branch Office (B.O)
- **Color Themes** — Color-code areas by state or office type
- **Click-to-Explore** — Click any pincode area to see detailed information
- **Responsive Design** — Works on desktop and mobile devices

## 📊 Data Source

- **Shapefile**: [justinelliotmeyers/INDIA_PINCODES](https://github.com/justinelliotmeyers/INDIA_PINCODES)
- **Total Records**: 19,312 pincode areas
- **Coverage**: All 36 States/UTs
- **Data Year**: 2022 — user discretion advised for up to date data
- **Geometry**: Polygon boundaries (simplified for web performance)

## 🚀 Live Demo

Visit the live dashboard at: [https://kaduvan.github.io/india-pincode-explorer/]

## 🛠️ Tech Stack

- **[Leaflet.js](https://leafletjs.com/)** — Interactive map library
- **[CartoDB Voyager](https://carto.com/basemaps)** — Clean basemap tiles
- **GeoJSON** — Simplified polygon data per state
- **Vanilla JS** — No build tools, no frameworks

## 📁 Project Structure

```
docs/
├── index.html              # Main dashboard page
├── style.css               # Styles
├── app.js                  # Application logic
└── data/
    ├── metadata.json       # State metadata & stats
    ├── search_index.csv    # Searchable pincode index
    ├── pincodes.geojson        # Combined GeoJSON (all pincodes)
    └── states/                 # GeoJSON per state
        ├── andhra_pradesh.geojson
        ├── maharashtra.geojson
        └── ...
```

## 🔧 Local Development

1. Clone this repository
2. Open `docs/index.html` in a browser, or serve with any HTTP server:
   ```bash
   cd docs
   python -m http.server 8000
   ```
3. Open `http://localhost:8000`

## 📝 License

Data sourced from [INDIA_PINCODES](https://github.com/justinelliotmeyers/INDIA_PINCODES). Dashboard code is open source.
