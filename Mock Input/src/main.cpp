#include <Arduino.h>

// put function declarations here:
int myFunction(int, int);

void setup() {
  // put your setup code here, to run once:
  int result = myFunction(2, 3);
}

void loop() {
  // put your main code here, to run repeatedly:
}

// put function definitions here:
int myFunction(int x, int y) {
  return x + y;
}

            model: [
                { name: "Dr. Himed", role: "Captain", color: "#74b9ff", image: "./assets/himed.webp"},
                { name: "Abdelghafar Ouissal", role: "Vice Captain", color: "#a29bfe", image: "./assets/ouissal.webp" },
                { name: "Abdellah Mebarki", role: "AI Navigator", color: "#55efc4", image: "./assets/abdellah.webp" },
                { name: "Abdel Moumene Saighi", role: "Communications", color: "#ff7675", image: "./assets/abdelmoumene.webp" },
                { name: "Belarbi Hiba", role: "Security", color: "#ffeaa7", image: "./assets/hiba.webp" },
                { name: "Heciane Hiba", role: "Engineer", color: "#fdcb6e", image: "./assets/himed.webp" }
            ]