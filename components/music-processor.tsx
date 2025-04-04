"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, Play, Pause, Download, Disc3, Volume2, AudioWaveformIcon as Waveform, Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Effect = "normal" | "8d" | "reverb" | "slow-reverb" | "bass-boost"

export default function MusicProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentEffect, setCurrentEffect] = useState<Effect>("normal")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)

  // Audio element for direct playback (fallback)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Web Audio API references
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const pannerNodeRef = useRef<StereoPannerNode | null>(null)
  const convolverNodeRef = useRef<ConvolverNode | null>(null)
  const biquadFilterRef = useRef<BiquadFilterNode | null>(null)
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Flag to track if audio processing is initialized
  const isInitializedRef = useRef<boolean>(false)

  // Set up audio element
  useEffect(() => {
    const audio = new Audio()

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration)
    })

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime)
    })

    audio.addEventListener("ended", () => {
      setIsPlaying(false)
    })

    audio.addEventListener("play", () => {
      setIsPlaying(true)
    })

    audio.addEventListener("pause", () => {
      setIsPlaying(false)
    })

    audioRef.current = audio

    return () => {
      cleanupAudio()

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
    }
  }, [])

  // Clean up all audio resources
  const cleanupAudio = () => {
    // Clear rotation interval
    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current)
      rotationIntervalRef.current = null
    }

    // Disconnect all nodes
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch (e) {
        console.log("Error disconnecting source node:", e)
      }
      sourceNodeRef.current = null
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect()
      } catch (e) {
        console.log("Error disconnecting gain node:", e)
      }
      gainNodeRef.current = null
    }

    if (pannerNodeRef.current) {
      try {
        pannerNodeRef.current.disconnect()
      } catch (e) {
        console.log("Error disconnecting panner node:", e)
      }
      pannerNodeRef.current = null
    }

    if (convolverNodeRef.current) {
      try {
        convolverNodeRef.current.disconnect()
      } catch (e) {
        console.log("Error disconnecting convolver node:", e)
      }
      convolverNodeRef.current = null
    }

    if (biquadFilterRef.current) {
      try {
        biquadFilterRef.current.disconnect()
      } catch (e) {
        console.log("Error disconnecting biquad filter:", e)
      }
      biquadFilterRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (e) {
        console.log("Error closing audio context:", e)
      }
      audioContextRef.current = null
    }

    // Reset initialization flag
    isInitializedRef.current = false
  }

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type.includes("audio")) {
      // Clean up previous audio resources
      cleanupAudio()

      setFile(selectedFile)

      // Revoke previous URL to prevent memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      const url = URL.createObjectURL(selectedFile)
      setAudioUrl(url)

      // Reset state
      setIsPlaying(false)
      setCurrentTime(0)
      setCurrentEffect("normal")

      // Set the audio source
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.load()
      }
    }
  }

  // Initialize audio processing
  const initializeAudioProcessing = async () => {
    if (!audioRef.current || !file || isInitializedRef.current) return

    try {
      setIsProcessing(true)

      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContext()

      // Create source node
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)

      // Create gain node
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.gain.value = volume / 100

      // Connect source to gain to destination (default setup)
      sourceNodeRef.current.connect(gainNodeRef.current)
      gainNodeRef.current.connect(audioContextRef.current.destination)

      // Mark as initialized
      isInitializedRef.current = true

      // Apply the current effect (without recursion)
      await applyEffectToInitializedAudio(currentEffect)
    } catch (error) {
      console.error("Error initializing audio:", error)

      // Fallback to direct audio playback if Web Audio API fails
      if (audioRef.current) {
        audioRef.current.volume = volume / 100
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Apply effect to already initialized audio
  const applyEffectToInitializedAudio = async (effect: Effect) => {
    if (!audioRef.current || !audioContextRef.current || !sourceNodeRef.current || !gainNodeRef.current) {
      return
    }

    try {
      setIsProcessing(true)

      // Resume audio context if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }

      // Disconnect source from previous effect chain
      sourceNodeRef.current.disconnect()

      // Disconnect gain from destination
      gainNodeRef.current.disconnect()

      // Clean up previous effect nodes
      if (pannerNodeRef.current) {
        pannerNodeRef.current.disconnect()
        pannerNodeRef.current = null
      }

      if (convolverNodeRef.current) {
        convolverNodeRef.current.disconnect()
        convolverNodeRef.current = null
      }

      if (biquadFilterRef.current) {
        biquadFilterRef.current.disconnect()
        biquadFilterRef.current = null
      }

      // Clear any existing rotation interval
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current)
        rotationIntervalRef.current = null
      }

      // Reset playback rate
      audioRef.current.playbackRate = 1.0

      // Apply different effects based on selection
      switch (effect) {
        case "8d":
          // Create stereo panner for 8D effect
          pannerNodeRef.current = audioContextRef.current.createStereoPanner()

          // Connect nodes
          sourceNodeRef.current.connect(pannerNodeRef.current)
          pannerNodeRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)

          // Create 8D rotation effect
          let panValue = 0
          let direction = 1 // 1 for right, -1 for left

          rotationIntervalRef.current = setInterval(() => {
            if (pannerNodeRef.current) {
              panValue += 0.02 * direction

              if (panValue > 0.9) {
                direction = -1
              } else if (panValue < -0.9) {
                direction = 1
              }

              pannerNodeRef.current.pan.value = panValue
            }
          }, 30)
          break

        case "reverb":
          // Create convolver node for reverb
          convolverNodeRef.current = audioContextRef.current.createConvolver()

          // Create reverb impulse response
          const impulseLength = audioContextRef.current.sampleRate * 2 // 2 seconds
          const impulse = audioContextRef.current.createBuffer(2, impulseLength, audioContextRef.current.sampleRate)

          // Fill impulse buffer with decaying noise
          for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel)
            for (let i = 0; i < impulseLength; i++) {
              channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (impulseLength * 0.3))
            }
          }

          convolverNodeRef.current.buffer = impulse

          // Connect nodes
          sourceNodeRef.current.connect(convolverNodeRef.current)
          convolverNodeRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          break

        case "slow-reverb":
          // Create convolver node for reverb
          convolverNodeRef.current = audioContextRef.current.createConvolver()

          // Create longer reverb impulse response for slow reverb
          const slowImpulseLength = audioContextRef.current.sampleRate * 4 // 4 seconds
          const slowImpulse = audioContextRef.current.createBuffer(
            2,
            slowImpulseLength,
            audioContextRef.current.sampleRate,
          )

          // Fill impulse buffer with slower decaying noise
          for (let channel = 0; channel < 2; channel++) {
            const channelData = slowImpulse.getChannelData(channel)
            for (let i = 0; i < slowImpulseLength; i++) {
              channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (slowImpulseLength * 0.5))
            }
          }

          convolverNodeRef.current.buffer = slowImpulse

          // Slow down playback rate
          audioRef.current.playbackRate = 0.8

          // Connect nodes
          sourceNodeRef.current.connect(convolverNodeRef.current)
          convolverNodeRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          break

        case "bass-boost":
          // Create biquad filter for bass boost
          biquadFilterRef.current = audioContextRef.current.createBiquadFilter()
          biquadFilterRef.current.type = "lowshelf"
          biquadFilterRef.current.frequency.value = 150
          biquadFilterRef.current.gain.value = 15

          // Connect nodes
          sourceNodeRef.current.connect(biquadFilterRef.current)
          biquadFilterRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          break

        default: // normal
          // Connect source directly to gain and output
          sourceNodeRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          break
      }
    } catch (error) {
      console.error("Error applying effect:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Apply effect (wrapper function)
  const applyEffect = async (effect: Effect) => {
    if (!file) return

    // If audio processing is not initialized, initialize it first
    if (!isInitializedRef.current) {
      await initializeAudioProcessing()
    } else {
      // Otherwise, just apply the effect to the initialized audio
      await applyEffectToInitializedAudio(effect)
    }
  }

  // Change effect
  const handleEffectChange = (effect: Effect) => {
    setCurrentEffect(effect)
    applyEffect(effect)
  }

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current || !file) return

    try {
      // Initialize audio processing on first play if not already done
      if (!isInitializedRef.current) {
        await initializeAudioProcessing()
      }

      if (isPlaying) {
        audioRef.current.pause()
      } else {
        // Resume AudioContext if it was suspended
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }

        // Play the audio
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Error playing audio:", error)
          })
        }
      }
    } catch (error) {
      console.error("Error toggling playback:", error)

      // Fallback to direct audio playback
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause()
        } else {
          audioRef.current.play().catch((e) => console.error("Fallback play error:", e))
        }
      }
    }
  }

  // Update volume
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume / 100
    }

    // Fallback for direct audio playback
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  // Update current time
  const handleTimeChange = (value: number[]) => {
    const newTime = value[0]
    setCurrentTime(newTime)

    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  // Format time in MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  // Download processed audio
  const downloadProcessedAudio = async () => {
    if (!audioRef.current || !file) return

    // For a real implementation, you would need to record the processed audio
    // This is a simplified version that just downloads the original file
    const a = document.createElement("a")
    a.href = audioUrl || ""
    a.download = `${currentEffect}-${file.name}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="bg-black/30 backdrop-blur-md border-purple-500/20 shadow-xl shadow-purple-900/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 pointer-events-none"></div>
        <CardContent className="p-6 relative z-10">
          <div className="mb-8">
            <label
              htmlFor="audio-upload"
              className={cn(
                "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer",
                "transition-all duration-300 ease-in-out",
                file
                  ? "border-purple-400 bg-purple-500/10"
                  : "border-gray-600 bg-black/20 hover:bg-black/30 hover:border-purple-500/50",
              )}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <div className="text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-full"></div>
                      <Music2 className="w-10 h-10 mb-2 text-purple-300 mx-auto relative" />
                    </div>
                    <p className="text-sm text-purple-200 truncate max-w-xs mt-2">{file.name}</p>
                    <p className="text-xs text-purple-300/70 mt-1">Click to change</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gray-500/10 blur-md rounded-full"></div>
                      <Upload className="w-10 h-10 mb-2 text-gray-400 mx-auto relative" />
                    </div>
                    <p className="text-sm text-gray-400 mt-2">Click to upload your audio file</p>
                    <p className="text-xs text-gray-500 mt-1">MP3, WAV, OGG, FLAC</p>
                  </div>
                )}
              </div>
              <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {file && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-pink-500/5 rounded-xl pointer-events-none"></div>

                <Tabs
                  defaultValue="normal"
                  value={currentEffect}
                  onValueChange={(value) => handleEffectChange(value as Effect)}
                  className="mb-6"
                >
                  <TabsList className="grid grid-cols-5 bg-black/40 mb-6 p-1 backdrop-blur-sm">
                    <TabsTrigger
                      value="normal"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-purple-500/30 data-[state=active]:text-white"
                    >
                      Original
                    </TabsTrigger>
                    <TabsTrigger
                      value="8d"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-purple-500/30 data-[state=active]:text-white"
                    >
                      8D
                    </TabsTrigger>
                    <TabsTrigger
                      value="reverb"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-purple-500/30 data-[state=active]:text-white"
                    >
                      Reverb
                    </TabsTrigger>
                    <TabsTrigger
                      value="slow-reverb"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-purple-500/30 data-[state=active]:text-white"
                    >
                      Slow Reverb
                    </TabsTrigger>
                    <TabsTrigger
                      value="bass-boost"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-purple-500/30 data-[state=active]:text-white"
                    >
                      Bass Boost
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="normal" className="text-center text-purple-200 space-y-2 py-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500/20 blur-lg rounded-full"></div>
                      <Disc3 className="w-16 h-16 mx-auto text-purple-300 relative" />
                    </div>
                    <h3 className="text-xl font-medium mt-2">Original Audio</h3>
                    <p className="text-sm text-purple-300/70">Unmodified audio with no effects applied</p>
                  </TabsContent>

                  <TabsContent value="8d" className="text-center text-purple-200 space-y-2 py-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500/20 blur-lg rounded-full"></div>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                        className="mx-auto w-16 h-16 relative"
                      >
                        <Disc3 className="w-16 h-16 text-purple-300" />
                      </motion.div>
                    </div>
                    <h3 className="text-xl font-medium mt-2">8D Audio</h3>
                    <p className="text-sm text-purple-300/70">Creates a rotating spatial effect around your head</p>
                  </TabsContent>

                  <TabsContent value="reverb" className="text-center text-purple-200 space-y-2 py-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500/20 blur-lg rounded-full"></div>
                      <Waveform className="w-16 h-16 mx-auto text-purple-300 relative" />
                    </div>
                    <h3 className="text-xl font-medium mt-2">Reverb</h3>
                    <p className="text-sm text-purple-300/70">Adds space and depth to your audio</p>
                  </TabsContent>

                  <TabsContent value="slow-reverb" className="text-center text-purple-200 space-y-2 py-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500/20 blur-lg rounded-full"></div>
                      <Waveform className="w-16 h-16 mx-auto text-purple-300 relative" />
                    </div>
                    <h3 className="text-xl font-medium mt-2">Slow Reverb</h3>
                    <p className="text-sm text-purple-300/70">Slowed tempo with extended reverb effect</p>
                  </TabsContent>

                  <TabsContent value="bass-boost" className="text-center text-purple-200 space-y-2 py-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500/20 blur-lg rounded-full"></div>
                      <Volume2 className="w-16 h-16 mx-auto text-purple-300 relative" />
                    </div>
                    <h3 className="text-xl font-medium mt-2">Bass Boost</h3>
                    <p className="text-sm text-purple-300/70">Enhances low frequencies for deeper bass</p>
                  </TabsContent>
                </Tabs>

                {isProcessing ? (
                  <div className="flex justify-center my-8">
                    <div className="animate-pulse text-purple-300 bg-purple-500/10 px-4 py-2 rounded-full">
                      Processing audio...
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-purple-200 bg-black/30 px-2 py-1 rounded-md">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-xs text-purple-200 bg-black/30 px-2 py-1 rounded-md">
                        {formatTime(duration)}
                      </span>
                    </div>

                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-purple-500/5 rounded-full blur"></div>
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleTimeChange}
                        className="relative z-10"
                      />
                    </div>

                    <div className="flex items-center justify-between mb-8">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={togglePlayPause}
                          variant="outline"
                          size="icon"
                          className="bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30 text-purple-200 shadow-lg shadow-purple-900/20"
                        >
                          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>
                      </motion.div>

                      <div className="flex items-center space-x-2 flex-1 max-w-xs mx-4">
                        <Volume2 className="h-4 w-4 text-purple-300" />
                        <div className="relative w-full">
                          <div className="absolute inset-0 bg-purple-500/5 rounded-full blur"></div>
                          <Slider
                            value={[volume]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={handleVolumeChange}
                            className="relative z-10"
                          />
                        </div>
                      </div>

                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={downloadProcessedAudio}
                          variant="outline"
                          size="icon"
                          className="bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30 text-purple-200 shadow-lg shadow-purple-900/20"
                        >
                          <Download className="h-5 w-5" />
                        </Button>
                      </motion.div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {!file && (
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="inline-block bg-black/20 backdrop-blur-sm px-6 py-3 rounded-full border border-purple-500/10">
            <p className="text-purple-200/70 text-sm">Upload an audio file to transform it with premium effects</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

