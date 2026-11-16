import os
import sys
from PySide6.QtCore import QObject, QUrl, Slot
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine


class CosmicBackend(QObject):

    def __init__(self):
        super().__init__()

    @Slot(str)
    def onProfileClicked(self, profile_name):
        print(f"[Python Backend] Profile selected: {profile_name}")

    @Slot(str, str)
    def onSwipe(self, profile_name, direction):
        print(
            f"[Python Backend] Action received -> Profile: {profile_name} | Swiped: {direction}"
        )
        # Handle your core logic here (e.g., load next profile, update database, etc.)


if __name__ == "__main__":
    app = QGuiApplication(sys.argv)
    engine = QQmlApplicationEngine()

    backend = CosmicBackend()
    engine.rootContext().setContextProperty("backend", backend)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    qml_file = os.path.join(current_dir, "space_view.qml")
    engine.load(QUrl.fromLocalFile(qml_file))

    if not engine.rootObjects():
        sys.exit(-1)

    sys.exit(app.exec())