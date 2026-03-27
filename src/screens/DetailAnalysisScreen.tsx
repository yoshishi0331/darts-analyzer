import { useMemo, useEffect, useState } from "react";
import { Alert, BackHandler } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer } from "expo-video";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { Screen } from "@/components/Screen";
import { ShootingTipsModal } from "@/components/ShootingTipsModal";
import { SessionSetupScreen } from "@/components/detail/SessionSetupScreen";
import { CompareScreen } from "@/components/detail/CompareScreen";
import { LandingScreen } from "@/components/detail/LandingScreen";
import { ReleaseScreen } from "@/components/detail/ReleaseScreen";
import { TARGET_POINTS } from "@/domain/targetPoints";
import { analyzeVideoPose, VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { Handedness, SessionConfig, ThrowIndex, ThrowWindow } from "@/domain/types";
import { RootTabParamList } from "@/navigation/AppNavigator";
import { useAppState } from "@/state/AppProvider";

type Props = BottomTabScreenProps<RootTabParamList, "Detail">;
type DetailStage = "setup" | "release" | "landing" | "compare";

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  targetLabel: null,
  measureGrouping: true,
  measureRelease: true,
  measureAim: true,
};

function createInitialWindows(): ThrowWindow[] {
  return [
    { startMillis: null, endMillis: null, releaseMillis: null, releasePoint: { x: 0.42, y: 0.36 }, impactPoint: null },
    { startMillis: null, endMillis: null, releaseMillis: null, releasePoint: { x: 0.48, y: 0.4 }, impactPoint: null },
    { startMillis: null, endMillis: null, releaseMillis: null, releasePoint: { x: 0.54, y: 0.37 }, impactPoint: null },
  ];
}

export function DetailAnalysisScreen({ navigation }: Props) {
  const { settings, selectedThrow, setSelectedThrow, saveDetailAnalysis } = useAppState();

  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [stage, setStage] = useState<DetailStage>("setup");
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [throwWindows, setThrowWindows] = useState<ThrowWindow[]>(() => createInitialWindows());
  const [analysis, setAnalysis] = useState<VideoPoseAnalysis | null>(null);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Compute which stages are active based on session config
  const activeSteps = useMemo<DetailStage[]>(() => {
    const steps: DetailStage[] = [];
    if (sessionConfig.measureRelease) steps.push("release");
    if (sessionConfig.measureGrouping || sessionConfig.measureAim) steps.push("landing");
    steps.push("compare");
    return steps;
  }, [sessionConfig]);

  const stepNumber = activeSteps.indexOf(stage) + 1;
  const totalSteps = activeSteps.length;

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

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stage === "setup") {
        navigation.navigate("Home");
        return true;
      }
      if (stage === "release") {
        setStage("setup");
        return true;
      }
      if (stage === "landing") {
        if (sessionConfig.measureRelease) {
          setSelectedThrow(0);
          setStage("release");
        } else {
          setStage("setup");
        }
        return true;
      }
      if (stage === "compare") {
        if (sessionConfig.measureGrouping || sessionConfig.measureAim) {
          setStage("landing");
        } else if (sessionConfig.measureRelease) {
          setStage("release");
        } else {
          setStage("setup");
        }
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stage, sessionConfig, navigation, setSelectedThrow]);

  useEffect(() => {
    if (stage === "landing") setSelectedThrow(0);
  }, [stage, setSelectedThrow]);

  const handleProceedFromSetup = async (config: SessionConfig) => {
    if (config.measureRelease) {
      // 動画選択が必要
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

      setSessionConfig(config);
      setVideoUri(result.assets[0].uri);
      setSelectedThrow(0);
      setThrowWindows(createInitialWindows());
      setStage("release");
    } else {
      // 動画不要: 直接 landing へ（グルーピング or 狙い精度のみ）
      setSessionConfig(config);
      setVideoUri(undefined);
      setSelectedThrow(0);
      setThrowWindows(createInitialWindows());
      setStage("landing");
    }
  };

  const updateThrowWindow = (index: ThrowIndex, patch: Partial<ThrowWindow>) => {
    setThrowWindows((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleReleaseProceed = () => {
    if (sessionConfig.measureGrouping || sessionConfig.measureAim) {
      setSelectedThrow(0);
      setStage("landing");
    } else {
      setStage("compare");
    }
  };

  const handleLandingProceed = () => {
    setStage("compare");
  };

  const handleCompareProceed = async () => {
    const releasePoints = throwWindows.map((w) => w.releasePoint);
    const boardHits = throwWindows.map((w) => w.impactPoint ?? { x: 0.5, y: 0.5 });
    const resolvedTargetPoint = sessionConfig.targetLabel != null
      ? TARGET_POINTS[sessionConfig.targetLabel]
      : null;

    const result = await saveDetailAnalysis({
      memo: "",
      videoUri,
      detailInputState: {
        boardHits,
        releasePoints,
        elbowPoints: [],
        targetLabel: sessionConfig.targetLabel ?? undefined,
        targetPoint: resolvedTargetPoint ?? undefined,
      },
      measureGrouping: sessionConfig.measureGrouping,
      measureRelease: sessionConfig.measureRelease,
      measureAim: sessionConfig.measureAim,
    });

    Alert.alert(result.ok ? "保存完了" : "保存できません", result.message, [
      {
        text: "OK",
        onPress: () => {
          if (result.ok) {
            setStage("setup");
            setThrowWindows(createInitialWindows());
            setVideoUri(undefined);
            setSessionConfig(DEFAULT_SESSION_CONFIG);
            navigation.navigate("Home");
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ShootingTipsModal />

      {stage === "setup" ? (
        <SessionSetupScreen
          config={sessionConfig}
          onConfigChange={setSessionConfig}
          onProceed={handleProceedFromSetup}
        />
      ) : stage === "release" ? (
        <ReleaseScreen
          player={player}
          videoUri={videoUri}
          throws={throwWindows}
          activeIndex={selectedThrow as ThrowIndex}
          analysis={analysis}
          stepNumber={stepNumber}
          totalSteps={totalSteps}
          onUpdateThrow={updateThrowWindow}
          onSelectThrow={(i) => setSelectedThrow(i)}
          onBack={() => setStage("setup")}
          onProceed={handleReleaseProceed}
        />
      ) : stage === "landing" ? (
        <LandingScreen
          throws={throwWindows}
          activeIndex={selectedThrow as ThrowIndex}
          stepNumber={stepNumber}
          totalSteps={totalSteps}
          onUpdateThrow={updateThrowWindow}
          onSelectThrow={(i) => setSelectedThrow(i)}
          onBack={() => {
            if (sessionConfig.measureRelease) {
              setSelectedThrow(0);
              setStage("release");
            } else {
              setStage("setup");
            }
          }}
          onProceed={handleLandingProceed}
        />
      ) : (
        <CompareScreen
          throwWindows={throwWindows}
          sessionConfig={sessionConfig}
          stepNumber={stepNumber}
          totalSteps={totalSteps}
          onBack={() => {
            if (sessionConfig.measureGrouping || sessionConfig.measureAim) {
              setStage("landing");
            } else if (sessionConfig.measureRelease) {
              setStage("release");
            } else {
              setStage("setup");
            }
          }}
          onProceed={handleCompareProceed}
        />
      )}
    </Screen>
  );
}
