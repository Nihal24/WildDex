from icrawler.builtin import BingImageCrawler

# Output directory for training images
output_base_dir = './dataset/train/'

# Refined class search queries to reduce noise (e.g., no cartoons/cooked animals)
classes = {
    'pidgeon': 'close-up pigeon bird outdoors',
    'goose': 'wild goose bird outdoors',
    'chicken': 'live chicken bird outdoors farm'
}

# Number of training images per class
num_train_images = 200

# Filtering to reduce irrelevant results
filters = dict(
    size='medium',
    type='photo',
    color='color'
)

# Crawl and save images
for class_name, keyword in classes.items():
    crawler = BingImageCrawler(storage={'root_dir': f'{output_base_dir}{class_name}'})
    crawler.crawl(keyword=keyword, max_num=num_train_images, filters=filters)

print("Training images downloaded to dataset/train/<class_name> folders.")