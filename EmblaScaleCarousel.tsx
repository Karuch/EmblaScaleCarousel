'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  EmblaCarouselType,
  EmblaEventType,
  EmblaOptionsType
} from 'embla-carousel'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './embla-scale.css'

const TWEEN_FACTOR_BASE = 0.52

const numberWithinRange = (number: number, min: number, max: number): number =>
  Math.min(Math.max(number, min), max)

export interface VideoSlide {
  id: number
  src: string
  title: string
}

type PropType = {
  slides: VideoSlide[]
  options?: EmblaOptionsType
}

const EmblaScaleCarousel: React.FC<PropType> = ({ slides, options }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(options)
  const tweenFactor = useRef(0)
  const tweenNodes = useRef<HTMLElement[]>([])
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)

  const setTweenNodes = useCallback((emblaApi: EmblaCarouselType): void => {
    tweenNodes.current = emblaApi.slideNodes().map((slideNode) =>
      slideNode.querySelector('.embla__slide__inner') as HTMLElement
    )
  }, [])

  const setTweenFactor = useCallback((emblaApi: EmblaCarouselType) => {
    tweenFactor.current = TWEEN_FACTOR_BASE * emblaApi.scrollSnapList().length
  }, [])

  const tweenScale = useCallback(
    (emblaApi: EmblaCarouselType, eventName?: EmblaEventType) => {
      const engine = emblaApi.internalEngine()
      const scrollProgress = emblaApi.scrollProgress()
      const slidesInView = emblaApi.slidesInView()
      const isScrollEvent = eventName === 'scroll'

      emblaApi.scrollSnapList().forEach((scrollSnap, snapIndex) => {
        let diffToTarget = scrollSnap - scrollProgress
        const slidesInSnap = engine.slideRegistry[snapIndex]

        slidesInSnap.forEach((slideIndex) => {
          if (isScrollEvent && !slidesInView.includes(slideIndex)) return
          if (engine.options.loop) {
            engine.slideLooper.loopPoints.forEach((loopItem) => {
              const target = loopItem.target()
              if (slideIndex === loopItem.index && target !== 0) {
                const sign = Math.sign(target)
                if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress)
                if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress)
              }
            })
          }
          const tweenValue = 1 - Math.abs(diffToTarget * tweenFactor.current)
          const scale = numberWithinRange(tweenValue, 0, 1).toString()
          const tweenNode = tweenNodes.current[slideIndex]
          if (tweenNode) tweenNode.style.transform = `scale(${scale})`
        })
      })
    },
    []
  )

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi])

  /* ---- Video play/pause + reset progress on slide change ---- */
  useEffect(() => {
    setVideoProgress(0)
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === selectedIndex) {
        v.currentTime = 0
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [selectedIndex])

  const handleVideoTimeUpdate = useCallback((index: number) => {
    if (index !== selectedIndex) return
    const video = videoRefs.current[index]
    if (!video || !video.duration || Number.isNaN(video.duration)) return
    setVideoProgress((video.currentTime / video.duration) * 100)
  }, [selectedIndex])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())

    setTweenNodes(emblaApi)
    setTweenFactor(emblaApi)
    tweenScale(emblaApi)
    onSelect()

    emblaApi
      .on('reInit', setTweenNodes)
      .on('reInit', setTweenFactor)
      .on('reInit', tweenScale)
      .on('scroll', tweenScale)
      .on('slideFocus', tweenScale)
      .on('select', onSelect)

    return () => {
      emblaApi
        .off('reInit', setTweenNodes)
        .off('reInit', setTweenFactor)
        .off('reInit', tweenScale)
        .off('scroll', tweenScale)
        .off('slideFocus', tweenScale)
        .off('select', onSelect)
    }
  }, [emblaApi, tweenScale, setTweenFactor, setTweenNodes])

  const handleVideoEnded = useCallback((index: number) => {
    if (!emblaApi || index !== emblaApi.selectedScrollSnap()) return
    emblaApi.scrollTo((index + 1) % slides.length)
  }, [emblaApi, slides.length])

  return (
    <div className="embla-scale">
      <div className="embla-scale__viewport" ref={emblaRef}>
        <div className="embla-scale__container">
          {slides.map((slide, index) => (
            <div className="embla-scale__slide" key={slide.id}>
              <div className="embla__slide__inner">
                <video
                  ref={(el) => { videoRefs.current[index] = el }}
                  src={slide.src}
                  className="embla__slide__video"
                  muted
                  playsInline
                  onTimeUpdate={() => handleVideoTimeUpdate(index)}
                  onEnded={() => handleVideoEnded(index)}
                />
                <div className="embla__slide__overlay">
                  <h3 className="embla__slide__title">{slide.title}</h3>
                </div>

                {/* Arrows inside each slide, only visible on active */}
                {index === selectedIndex && (
                  <>
                    <button
                      className="embla-scale__btn embla-scale__btn--prev"
                      onClick={(e) => { e.stopPropagation(); scrollPrev() }}
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      className="embla-scale__btn embla-scale__btn--next"
                      onClick={(e) => { e.stopPropagation(); scrollNext() }}
                      aria-label="Next slide"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </>
                )}

                {/* Progress bar inside the slide */}
                {index === selectedIndex && (
                  <div className="embla-scale__progress-track">
                    <div
                      className="embla-scale__progress-bar"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="embla-scale__dots">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`embla-scale__dot ${i === selectedIndex ? 'embla-scale__dot--active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

export default EmblaScaleCarousel
