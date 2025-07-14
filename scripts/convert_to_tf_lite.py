import tensorflow as tf

# Load the model
model = tf.keras.models.load_model("wilddex_bird_model.keras")

# Convert to TFLite
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

# Save it to your project directory
output_path = "assets/models/wilddex_model.tflite"  # <-- create folders if they don't exist
with open(output_path, "wb") as f:
    f.write(tflite_model)

print(f"✅ Model saved to {output_path}")
