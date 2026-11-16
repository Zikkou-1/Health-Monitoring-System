import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia

Window {
    id: mainWindow
    width: 1280
    height: 720
    visible: true
    title: "Cosmic Profile Dashboard"

    property string activeProfile: ""
    property var activeProfileData: null

    // 1. VIDEO PLAYER BACKEND
    MediaPlayer {
        id: videoPlayer
        source: "./assets/lobby.mov"
        loops: MediaPlayer.Infinite
        videoOutput: videoOutput
        audioOutput: AudioOutput { muted: true }
        Component.onCompleted: videoPlayer.play()
    }

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
    }

    // Header Text
    Text {
        id: statusText
        anchors.top: parent.top
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.topMargin: 40
        text: mainWindow.activeProfile === "" ? "Select a Profile..." : "Active Profile: " + mainWindow.activeProfile
        color: "#dfe6e9"
        font.pixelSize: 22
        font.bold: true
        z: 20
    }

    // Back Button
    Button {
        text: "← Back to Grid"
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.margins: 30
        visible: mainWindow.activeProfile !== ""
        z: 20
        width: 100
        onClicked: {
            mainWindow.activeProfile = ""
            mainWindow.activeProfileData = null
        }
    }

    // 2. PROFILE GRID
    GridLayout {
        id: gridLayout
        anchors.centerIn: parent
        columns: 3
        rows: 2
        rowSpacing: 30
        columnSpacing: 30

        readonly property var profileList: [
                { name: "Dr. Himed", role: "Captain", color: "#74b9ff", image: "./assets/himed.webp"},
                { name: "Abdelghafar Ouissal", role: "Vice Captain", color: "#a29bfe", image: "./assets/ouissal.webp" },
                { name: "Abdellah Mebarki", role: "AI Navigator", color: "#55efc4", image: "./assets/abdellah.webp" },
                { name: "Abdel Moumene Saighi", role: "Communications", color: "#ff7675", image: "./assets/abdelmoumene.webp" },
                { name: "Belarbi Hiba", role: "Security", color: "#ffeaa7", image: "./assets/hiba.webp" },
                { name: "Heciane Hiba", role: "Engineer", color: "#fdcb6e", image: "./assets/himed.webp" }
            ]

        Repeater {
            model: gridLayout.profileList

            delegate: Item {
                id: delegateRoot
                width: 280
                height: 180

                readonly property bool isSelected: (mainWindow.activeProfile === modelData.name)
                readonly property bool anySelected: (mainWindow.activeProfile !== "")

                // Fade out grid cards when something is selected
                opacity: anySelected ? 0 : 1
                Behavior on opacity {
                    NumberAnimation { duration: 300; easing.type: Easing.InOutQuad }
                }

                // Disable interaction when hidden
                visible: opacity > 0

                Rectangle {
                    id: profileCard
                    anchors.fill: parent
                    color: "#1e1e2ef8"
                    radius: 16
                    border.color: modelData.color
                    border.width: 1.5

                    ColumnLayout {
                        anchors.centerIn: parent
                        spacing: 10

                        Item {
                            Layout.alignment: Qt.AlignCenter
                            width: 60; height: 60

                            Rectangle {
                                anchors.fill: parent
                                radius: width / 2
                                color: "transparent"
                                clip: true

                                Image {
                                    anchors.fill: parent
                                    source: modelData.image
                                    fillMode: Image.PreserveAspectCrop
                                    asynchronous: true
                                }
                            }
                        }

                        Text {
                            Layout.alignment: Qt.AlignCenter
                            text: modelData.name
                            color: "white"; font.pixelSize: 18; font.bold: true
                        }

                        Text {
                            Layout.alignment: Qt.AlignCenter
                            text: modelData.role
                            color: modelData.color; font.pixelSize: 14
                        }
                    }
                        Rectangle {
                            id: swipeRightText
                            anchors.left: parent.left
                            radius: 20
                            Text {
                                Layout.alignment: Qt.AlignCenter
                                text: "Swipe Left"
                                color: "white"; font.pixelSize: 28; font.bold: true
                            }
                        }

                    MouseArea {
                        anchors.fill: parent
                        hoverEnabled: !anySelected
                        onEntered: profileCard.scale = 1.05
                        onExited: profileCard.scale = 1.
                        onClicked: {
                            if (mainWindow.activeProfile === "") {
                                mainWindow.activeProfile = modelData.name
                                mainWindow.activeProfileData = modelData
                                backend.onProfileClicked(modelData.name)
                            }
                        }
                    }
                }
            }
        }
    }
// 3. CENTERED OVERLAY CARD WITH SWIPE DETECTION
    Item {
        id: zoomedOverlay
        anchors.centerIn: parent
        width: 280
        height: 180
        
        property real startMouseX: 0
        property real dragOffset: 0

        scale: mainWindow.activeProfile !== "" ? 2.2 : 0.0
        opacity: mainWindow.activeProfile !== "" ? 1.0 : 0.0
        visible: opacity > 0
        z: 50

        // Allow the card to follow the mouse horizontally while dragging
        transform: Translate {
            x: zoomedOverlay.dragOffset
        }

        Behavior on scale {
            NumberAnimation { duration: 400; easing.type: Easing.OutBack }
        }
        Behavior on opacity {
            NumberAnimation { duration: 300; easing.type: Easing.InOutQuad }
        }

        Rectangle {
            id: zoomedCardContent
            anchors.fill: parent
            color: "#1e1e2ef8"
            radius: 16
            border.color: mainWindow.activeProfileData ? mainWindow.activeProfileData.color : "white"
            border.width: 1.5

            ColumnLayout {
                anchors.centerIn: parent
                spacing: 10

                Item {
                    Layout.alignment: Qt.AlignCenter
                    width: 60; height: 60

                    Rectangle {
                        anchors.fill: parent
                        radius: width / 2
                        color: "transparent"
                        clip: true

                        Image {
                            anchors.fill: parent
                            source: mainWindow.activeProfileData ? mainWindow.activeProfileData.image : ""
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                        }
                    }
                }

                Text {
                    Layout.alignment: Qt.AlignCenter
                    text: mainWindow.activeProfileData ? mainWindow.activeProfileData.name : ""
                    color: "white"; font.pixelSize: 18; font.bold: true
                }

                Text {
                    Layout.alignment: Qt.AlignCenter
                    text: mainWindow.activeProfileData ? mainWindow.activeProfileData.role : ""
                    color: mainWindow.activeProfileData ? mainWindow.activeProfileData.color : "white"
                    font.pixelSize: 14
                }
            }

            // Mouse Area to track dragging and swiping
            MouseArea {
                anchors.fill: parent
                
                onPressed: (mouse) => {
                    zoomedOverlay.startMouseX = mouse.x
                }

                onPositionChanged: (mouse) => {
                    // Card moves fluidly left/right with the mouse cursor while dragging
                    zoomedOverlay.dragOffset = mouse.x - zoomedOverlay.startMouseX
                }

                onReleased: (mouse) => {
                    let distance = mouse.x - zoomedOverlay.startMouseX
                    let threshold = 60 // Minimum pixels to count as a swipe

                    if (distance > threshold) {
                        // Swiped Right
                        backend.onSwipe(mainWindow.activeProfile, "right")
                        playSwipeOutAnimation(400) // Fly off to the right
                    } 
                    else if (distance < -threshold) {
                        // Swiped Left
                        backend.onSwipe(mainWindow.activeProfile, "left")
                        playSwipeOutAnimation(-400) // Fly off to the left
                    } 
                    else {
                        // Snap back to center if swipe wasn't far enough
                        snapBackAnim.start()
                    }
                }
            }
        }

        // Animation when swiped successfully (flies off screen, then resets)
        NumberAnimation {
            id: swipeOutAnim
            target: zoomedOverlay
            property: "dragOffset"
            duration: 250
            easing.type: Easing.InQuad
            onFinished: {
                // Reset states after animation finishes
                zoomedOverlay.dragOffset = 0
                mainWindow.activeProfile = ""
                mainWindow.activeProfileData = null
            }
        }

        // Animation to snap card back if swipe threshold wasn't met
        NumberAnimation {
            id: snapBackAnim
            target: zoomedOverlay
            property: "dragOffset"
            to: 0
            duration: 200
            easing.type: Easing.OutBack
        }

        function playSwipeOutAnimation(targetX) {
            swipeOutAnim.to = targetX
            swipeOutAnim.start()
        }
    }}