"""Build the site's public, JSON-safe listing data from the classroom CSVs."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root.parent / 'data' / 'denver'
patterns = {
    'walkingCount': re.compile(r'\b(?:walkable|walkability|walk|walks|walked|walking|sidewalk|sidewalks|on foot)\b', re.I),
    'transitCount': re.compile(r'\b(?:public transit|public transport|public transportation|light rail|bus|buses|train|trains|union station)\b', re.I),
}
review_counts = defaultdict(lambda: {'sampleCount': 0, 'walkingCount': 0, 'transitCount': 0})
with (source / 'denver_reviews_sample.csv').open() as file:
    for row in csv.DictReader(file):
        counts = review_counts[row['listing_id']]
        counts['sampleCount'] += 1
        for key, pattern in patterns.items():
            counts[key] += int(bool(pattern.search(row['review_text'])))

def number(value):
    return float(value) if value.strip() else None

listings = []
with (source / 'denver_listings.csv').open() as file:
    for row in csv.DictReader(file):
        listing = {
            'id': row['listing_id'],  # Preserve IDs beyond JavaScript's safe integer range.
            'title': row['name'], 'neighborhood': row['neighbourhood'],
            'roomType': row['room_type'], 'guests': number(row['accommodates']),
            'bedrooms': number(row['bedrooms']),
            'price': number(row['price'].replace('$', '').replace(',', '')),
            'minNights': number(row['minimum_nights']),
            'rating': number(row['overall_rating']),
            'locationRating': number(row['location_rating']),
            'reviewCount': number(row['number_of_reviews']),
            'lat': number(row['latitude']), 'lng': number(row['longitude']),
            **review_counts[row['listing_id']],
        }
        listings.append(listing)
(root / 'data' / 'listings.json').write_text(json.dumps(listings, ensure_ascii=False, separators=(',', ':'), allow_nan=False))
print(f'Prepared {len(listings):,} listings. Source CSVs were not changed.')
