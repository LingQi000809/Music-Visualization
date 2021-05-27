# [DEMO](https://lingqi000809.github.io/Music-Visualization/)
This project aims to use color information to represent musical data, and create a meaningful and intuitive visualization.

The current version is just a rough demo with simple interfaces. Follow these steps to create a music visualization for a piece of your selection:
1. Upload **an image file for a color wheel** via the file input button at the top. I recommend using `img/colorSquare.png`. This image is used for the *vector addition algorithm* to pick the resulting color.
2. Drop **the MIDI file** of the music that you hope to visualize into the dashed area. The visualization will be drawn using the *key-finding algorithm* on a 1-measure *window unit*.
3. Experiment with **different parameters** on the bottom. Next section explains the concept of *windows* and the mechanics behind each algorithm.
4. A 4-measure or 16-measure window unit with the key-addition algorithm or the key-finding algorithm seems to yield the most intriguing visualization.


# Key concepts and algorithms
## Windows
This program uses a window-based approach. The entire piece is equally divided into windows with the specified window size, and the algorithm is performed on each window. 
In this demo, the windows have width in terms of measures (musical bars). You may customize the window size in the parameter bar. For example, if you choose 4, then the program will apply the selected algorithm on four measures at a time.

## Algorithms
### key-finding
This algorithm is proposed by Krumhansl(1990). It successfully identifies the key of the musical selection. With this algorithm, the program decides the key of each window and finds the corresponding color in a predefined set of key-color mapping.
Information about how the key-finding algorithm works can be found in this document: http://rnhart.net/articles/key-finding/
