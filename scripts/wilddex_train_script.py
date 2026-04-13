import os, argparse, json
import tensorflow as tf
from tensorflow.keras import layers

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--epochs-frozen',   type=int,   default=15)
    p.add_argument('--epochs-finetune', type=int,   default=20)
    p.add_argument('--batch-size',      type=int,   default=32)
    p.add_argument('--lr-head',         type=float, default=1e-3)
    p.add_argument('--lr-finetune',     type=float, default=1e-5)
    p.add_argument('--model_dir',       type=str,   default='/tmp/model')  # ignored — always save to SM_MODEL_DIR
    p.add_argument('--train',           type=str,   default=os.environ.get('SM_CHANNEL_TRAIN', 'dataset/train'))
    p.add_argument('--val',             type=str,   default=os.environ.get('SM_CHANNEL_VAL',   'dataset/val'))
    return p.parse_args()

def main():
    args = parse_args()
    IMAGE_SIZE = (224, 224)

    # ── Data ────────────────────────────────────────────────────────────────
    train_ds = tf.keras.preprocessing.image_dataset_from_directory(
        args.train, image_size=IMAGE_SIZE, batch_size=args.batch_size,
        label_mode='int', seed=42,
    )
    val_ds = tf.keras.preprocessing.image_dataset_from_directory(
        args.val, image_size=IMAGE_SIZE, batch_size=args.batch_size,
        label_mode='int', seed=42,
    )
    class_names = train_ds.class_names
    num_classes = len(class_names)
    print(f"Classes: {num_classes}")

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.shuffle(200).prefetch(1)
    val_ds   = val_ds.prefetch(1)

    # ── Augmentation ────────────────────────────────────────────────────────
    aug = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.15),
        layers.RandomZoom(0.15),
        layers.RandomBrightness(0.15),
        layers.RandomContrast(0.15),
    ], name="augmentation")

    # ── Model ────────────────────────────────────────────────────────────────
    base = tf.keras.applications.EfficientNetB0(
        input_shape=(224, 224, 3), include_top=False, weights="imagenet"
    )
    base.trainable = False

    inputs  = tf.keras.Input(shape=(224, 224, 3))
    x       = aug(inputs)
    x       = base(x, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.BatchNormalization()(x)
    x       = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    model   = tf.keras.Model(inputs, outputs)

    # ── Phase 1: Train head ──────────────────────────────────────────────────
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr_head),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    callbacks1 = [
        tf.keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=2, verbose=1),
    ]
    print("=== Phase 1: Training head ===")
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_frozen, callbacks=callbacks1)

    # ── Phase 2: Fine-tune top 30 base layers ───────────────────────────────
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr_finetune),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    callbacks2 = [
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3, verbose=1),
    ]
    print("=== Phase 2: Fine-tuning ===")
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune, callbacks=callbacks2)

    # ── Evaluate ─────────────────────────────────────────────────────────────
    val_loss, val_acc = model.evaluate(val_ds)
    print(f"\nFinal val accuracy: {val_acc*100:.1f}%")

    # ── Save to local SM_MODEL_DIR — SageMaker syncs this to S3 automatically ─
    save_dir = os.environ.get('SM_MODEL_DIR', '/opt/ml/model')
    os.makedirs(save_dir, exist_ok=True)

    # Save TFLite (float16) — ready to drop into the app
    print("Converting to TFLite float16...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()
    with open(os.path.join(save_dir, "wilddex_model.tflite"), "wb") as f:
        f.write(tflite_model)
    size_mb = len(tflite_model) / 1024 / 1024
    print(f"TFLite saved — {size_mb:.1f} MB")

    # Save labels
    with open(os.path.join(save_dir, "labels.json"), "w") as f:
        json.dump(class_names, f)
    with open(os.path.join(save_dir, "labels.txt"), "w") as f:
        f.write("\n".join(class_names))

    print("Training complete.")

if __name__ == "__main__":
    main()
