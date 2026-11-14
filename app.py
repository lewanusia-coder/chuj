from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Przykładowe dane, które Python wyśle do mapy 3D
LOCATIONS = {
    "earth": [
        {
            "name": "Warszawa",
            "lat": 52.23,
            "lon": 21.01,
            "info": "Stolica Polski",
        },
        {
            "name": "Rów Mariański",
            "lat": 11.35,
            "lon": 142.2,
            "info": "Najgłębsze miejsce na Ziemi",
        },
    ],
    "mars": [
        {
            "name": "Olympus Mons",
            "lat": 18.65,
            "lon": 226.2,
            "info": "Najwyższy wulkan w Układzie Słonecznym",
        }
    ],
    "moon": [
        {
            "name": "Morze Spokoju",
            "lat": 0.67,
            "lon": 23.47,
            "info": "Miejsce lądowania Apollo 11",
        }
    ],
}


@app.route("/")
def index():
  return render_template("index.html")


@app.route("/api/locations/<planet>")
def get_locations(planet):
  return jsonify(LOCATIONS.get(planet, []))


if __name__ == "__main__":
  app.run(debug=True)