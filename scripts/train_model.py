import tensorflow as tf
from tensorflow.keras import layers
import matplotlib.pyplot as plt

# Constants
IMAGE_SIZE = (224, 224)  # MobileNetV2 expects 224x224
BATCH_SIZE = 16
EPOCHS_FROZEN = 10       # Phase 1: train only the new head
EPOCHS_FINETUNE = 10     # Phase 2: unfreeze and fine-tune top layers
NUM_CLASSES = 3

# Data augmentation to help generalize with small datasets
data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.1),
    layers.RandomBrightness(0.1),
])

# Load datasets
train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    "dataset/train",
    seed=123,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE
)

val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    "dataset/val",
    seed=123,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE
)

# Get class names before prefetching
class_names = train_ds.class_names
print(f"Classes: {class_names}")

# Prefetch
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)

# --- Build model with MobileNetV2 as base ---

# MobileNetV2 pretrained on ImageNet, no top layer
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet'
)
# Freeze the base — we only train our new head in phase 1
base_model.trainable = False

inputs = tf.keras.Input(shape=(224, 224, 3))
x = data_augmentation(inputs)
# MobileNetV2 expects inputs preprocessed to [-1, 1]
x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x)
outputs = layers.Dense(NUM_CLASSES, activation='softmax')(x)

model = tf.keras.Model(inputs, outputs)

model.summary()

# --- Phase 1: Train only the head ---
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

print("\n=== Phase 1: Training head (base frozen) ===")
history1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS_FROZEN
)

# --- Phase 2: Fine-tune top layers of base model ---
base_model.trainable = True

# Only unfreeze the last 30 layers of MobileNetV2
for layer in base_model.layers[:-30]:
    layer.trainable = False

# Lower learning rate for fine-tuning
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

print("\n=== Phase 2: Fine-tuning top layers ===")
history2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS_FINETUNE
)

# Save
model.save("wilddex_bird_model.keras")
print("\nModel saved to wilddex_bird_model.keras")
print(f"Input size: 224x224")
print(f"Classes (alphabetical): {class_names}")

# Plot
acc = history1.history['accuracy'] + history2.history['accuracy']
val_acc = history1.history['val_accuracy'] + history2.history['val_accuracy']
loss = history1.history['loss'] + history2.history['loss']
val_loss = history1.history['val_loss'] + history2.history['val_loss']
epochs_range = range(EPOCHS_FROZEN + EPOCHS_FINETUNE)

plt.figure(figsize=(10, 4))
plt.subplot(1, 2, 1)
plt.plot(epochs_range, acc, label='Train Acc')
plt.plot(epochs_range, val_acc, label='Val Acc')
plt.axvline(x=EPOCHS_FROZEN, color='gray', linestyle='--', label='Fine-tune start')
plt.title("Accuracy")
plt.legend()

plt.subplot(1, 2, 2)
plt.plot(epochs_range, loss, label='Train Loss')
plt.plot(epochs_range, val_loss, label='Val Loss')
plt.axvline(x=EPOCHS_FROZEN, color='gray', linestyle='--', label='Fine-tune start')
plt.title("Loss")
plt.legend()
plt.tight_layout()
plt.savefig("training_results.png")
plt.show()
