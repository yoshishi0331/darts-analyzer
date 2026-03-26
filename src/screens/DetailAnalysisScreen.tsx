import { useEffect, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer } from "expo-video";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { Screen } from "@/components/Screen";
import { CompareScreen } from "@/components/detail/CompareScreen";
import { LandingScreen } from "@/components/detail/LandingScreen";
import { ReleaseScreen } from "@/components/detail/ReleaseScreen";
import { SegmentScreen, ThrowWindow } from "@/components/detail/SegmentScreen";
import { TARGET_POINTS, TargetScreen } from "@/components/detail/TargetScreen";
import { analyzeVideoPose, VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { Handedness, TargetLabel, ThrowIndex } from "@/domain/types";
import { RootTabParamList } from "@/navigation/AppNavigator";
import { useAppState } from "@/state/AppProvider";

type Props = BottomTabScreenProps<RootTabParamList, "Detail">;
type DetailStage = "segment" | "release" | "target" | "landing" | "compare";

function createInitialWindows(): ThrowWindow[] {
  return [
    { startMillis: 400, endMillis: 1100, releaseMillis: null, releasePoint: { x: 0.42, y: 0.36 }, impactPoint: null },
    { startMillis: 1450, endMillis: 2150, releaseMillis: null, releasePoint: { x: 0.48, y: 0.4 }, impactPoint: null },
    { startMillis: 2500, endMillis: 3200, releaseMillis: null, releasePoint: { x: 0.54, y: 0.37 }, impactPoint: null },
  ];
}

export function DetailAnalysisScreen({ navigation }: Props) {
  const { settings, selectedThrow, setSelectedThrow, saveDetailAnalysis } = useAppState();

  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [stage, setStage] = useState<DetailStage>("segment");
  const [throwWindows, setThrowWindows] = useState<ThrowWindow[]>(() => createInitialWindows());
  const [analysis, setAnalysis] = useState<VideoPoseAnalysis | null>(null);
  const [targetLabel, setTargetLabel] = useState<TargetLabel | null>(null);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    setAnalysis(null);
    if (videoUri) {
      void player.replaceAsync(videoUri);
      const sub = player.addListener("sourceLoad", ({ duration }) => {
        sub.remove();
        void analyzeVideoPose({
          videoUri,
          durationSeconds: duration,
          handedness: settings.handedness as Handedness,
        }).then((result) => {
          setAnalysis(result);
        });
      });
    }
  }, [videoUri, player, settings.handedness]);

  const handleChooseVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    if (!permission.granted) {
      Alert.alert("動画へアクセスできません", "メディアライブラリへのアクセスを許可してください。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return;

    setVideoUri(result.assets[0].uri);
    setStage("segment");
    setSelectedThrow(0);
    setThrowWindows(createInitialWindows());
    setTargetLabel(null);
  };

  const updateThrowWindow = (index: ThrowIndex, patch: Partial<ThrowWindow>) => {
    setThrowWindows((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleSegmentProceed = () => {
    const hasAllRanges = throwWindows.every(
      (w) => w.startMillis !== null && w.endMillis !== null && w.endMillis > w.startMillis,
    );
    if (!hasAllRanges) {
      Alert.alert(
        "リリース区間が足りません",
        "1投目 / 2投目 / 3投目 それぞれでセットアップとリリース後を設定してから進んでください。",
      );
      return;
    }
    setSelectedThrow(0);
    setStage("release");
  };

  const handleReleaseProceed = () => {
    setStage("target");
  };

  const handleTargetProceed = () => {
    setSelectedThrow(0);
    setStage("landing");
  };

  const handleLandingProceed = () => {
    setStage("compare");
  };

  const handleCompareProceed = async () => {
    const releasePoints = throwWindows.map((w) => w.releasePoint);
    const boardHits = throwWindows.map((w) => w.impactPoint ?? { x: 0.5, y: 0.5 });
    const resolvedTargetPoint = TARGET_POINTS[targetLabel!];

    const result = await saveDetailAnalysis({
      memo: "",
      videoUri,
      detailInputState: {
        boardHits,
        releasePoints,
        elbowPoints: [],
        targetLabel: targetLabel!,
        targetPoint: resolvedTargetPoint,
      },
    });

    Alert.alert(result.ok ? "保存完了" : "保存できません", result.message, [
      {
        text: "OK",
        onPress: () => {
          if (result.ok) {
            setStage("segment");
            setThrowWindows(createInitialWindows());
            setVideoUri(undefined);
            setTargetLabel(null);
            navigation.navigate("Home");
          }
        },
      },
    ]);
  };

  return (
    <Screen>

      {stage === "segment" ? (
        <SegmentScreen
          player={player}
          videoUri={videoUri}
          throws={throwWindows}
          activeIndex={selectedThrow as ThrowIndex}
          analysis={analysis}
          onUpdateThrow={updateThrowWindow}
          onSelectThrow={(i) => setSelectedThrow(i)}
          onChooseVideo={handleChooseVideo}
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("Home");
            }
          }}
          onProceed={handleSegmentProceed}
        />
      ) : stage === "release" ? (
        <ReleaseScreen
          player={player}
          videoUri={videoUri}
          throws={throwWindows}
          activeIndex={selectedThrow as ThrowIndex}
          analysis={analysis}
          onUpdateThrow={updateThrowWindow}
          onSelectThrow={(i) => setSelectedThrow(i)}
          onBack={() => {
            setSelectedThrow(0);
            setStage("segment");
          }}
          onProceed={handleReleaseProceed}
        />
      ) : stage === "target" ? (
        <TargetScreen
          targetLabel={targetLabel}
          onSelectTarget={setTargetLabel}
          onBack={() => {
            setSelectedThrow(0);
            setStage("release");
          }}
          onProceed={handleTargetProceed}
        />
      ) : stage === "landing" ? (
        <LandingScreen
          throws={throwWindows}
          activeIndex={selectedThrow as ThrowIndex}
          onUpdateThrow={updateThrowWindow}
          onSelectThrow={(i) => setSelectedThrow(i)}
          onBack={() => setStage("target")}
          onProceed={handleLandingProceed}
        />
      ) : (
        <CompareScreen
          throwWindows={throwWindows}
          targetLabel={targetLabel}
          onBack={() => setStage("landing")}
          onProceed={handleCompareProceed}
        />
      )}
    </Screen>
  );
}

