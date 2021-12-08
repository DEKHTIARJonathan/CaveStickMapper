function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function write_angle(angle) {
  $("#swim_heading").text(angle);
}

function write_distance(segment_distance, edge_distance) {
  $("#edge_distance").text(edge_distance.toFixed(1));
  try{$("#segment_distance").text(segment_distance.toFixed(1));} catch {}
}

function get_distance(x1, x2, y1, y2, scale_factor){
  let y = x2 - x1;
  let x = y2 - y1;
  
  return (Math.sqrt(x * x + y * y) / scale_factor);
}

function compute_angle(x1, x2, y1, y2) {
    // NOTE: Remember that most math has the Y axis as positive above the X.
    // However, for screens we have Y as positive below. For this reason,
    // the Y values are inverted to get the expected results.
    var deltaY = (y1 - y2);
    var deltaX = (x2 - x1);

    var angle = (Math.atan2(deltaY, deltaX) - Math.atan2(1, 0)) * (180/Math.PI);
    return Math.round(-(angle - 360) % 360);
}

function get_cardinal_direction(heading) {
  // http://snowfence.umn.edu/Components/winddirectionanddegrees.htm
  if (heading < 0 || heading > 360) {
    var err_msg = "Invalid heading value received: " + heading;
    alert(err_msg);
    throw err_msg;
  }
  switch (true) {
    case (heading > 348 || heading <= 11):
      return "N";
    case (heading > 11 && heading <= 33):
      return "NNE";
    case (heading > 33 && heading <= 56):
      return "NE";
    case (heading > 56 && heading <= 78):
      return "ENE";
    case (heading > 78 && heading <= 101):
      return "E";
    case (heading > 101 && heading <= 123):
      return "ESE";
    case (heading > 123 && heading <= 146):
        return "SE";
    case (heading > 146 && heading <= 168):
        return "SSE";
    case (heading > 168 && heading <= 191):
        return "S";
    case (heading > 191 && heading <= 213):
        return "SSW";
    case (heading > 213 && heading <= 236):
        return "SW";
    case (heading > 236 && heading <= 258):
        return "WSW";
    case (heading > 258 && heading <= 281):
        return "W";
    case (heading > 281 && heading <= 303):
        return "WNW";
    case (heading > 303 && heading <= 326):
        return "NW";
    case (heading > 326 && heading <= 348):
        return "NNW";
    default:
        alert("Error in the function");
        return "";
  }
}

class CanvasManager {
  constructor(
    distance_scale_factor=7, 
    stroke_style="orange", 
    stroke_width=3, 
    refresh_rate=10
  ) {

    this.canvas = $("#canvas");
    this.ctx = this.canvas.get(0).getContext("2d");

    this.canvas_grid = $("#canvas_grid");
    this.ctx_grid = this.canvas_grid.get(0).getContext("2d");

    var canvasOffset = this.canvas.offset();
    this.offsetX = canvasOffset.left;
    this.offsetY = canvasOffset.top;

    this.stored_segments = [];
    this.current_segment_length = 0;
    this.last_update = (new Date).getTime();
    this.refresh_rate = 1000/refresh_rate;
    this.startX = 0;
    this.startY = 0;
    this.isDrawing = false;
    this.first_edge = false;

    this.stroke_style = stroke_style;
    this.stroke_width = stroke_width;
    this.distance_scale_factor = distance_scale_factor;

    this.rescale_canvas();
  }

  #reset_ctx_state() {
    this.ctx.clearRect(0, 0, this.canvas.width(), this.canvas.height());
  }

  #draw_grid(){
    this.ctx_grid.clearRect(0, 0, this.canvas_grid.width(), this.canvas_grid.height());

    this.ctx_grid.strokeStyle = "black";
    this.ctx_grid.lineWidth = 1;
    this.ctx_grid.globalAlpha = 0.1;

    for (var x = 0; x <= this.ctx_grid.canvas.width; x += this.distance_scale_factor) {
      this.ctx_grid.moveTo(0.5 + x, 0);
      this.ctx_grid.lineTo(0.5 + x, this.ctx_grid.canvas.height);
    }

    for (var x = 0; x <= this.ctx_grid.canvas.height; x += this.distance_scale_factor) {
      this.ctx_grid.moveTo(0, 0.5 + x);
      this.ctx_grid.lineTo(this.ctx_grid.canvas.width, 0.5 + x);
    }

    this.ctx_grid.stroke();

    this.ctx.strokeStyle = this.stroke_style;
    this.ctx.lineWidth = this.stroke_width;
    this.ctx.globalAlpha = 1;
  }

  #draw_point(x, y){
    this.ctx.beginPath();
    this.ctx.arc(x, y, 2, 0, 2 * Math.PI, true);
    this.ctx.fill();
  }

  #redrawStoredLines() {
    if (this.stored_segments.length == 0) {
      return;
    }
    this.#reset_ctx_state();
    
    var points_to_draw = [];

    this.ctx.beginPath();
    for (var segment_id = 0; segment_id < this.stored_segments.length; segment_id++) {

      const current_segment = this.stored_segments[segment_id];

      // draw the initial segment point
      if (current_segment.length == 0) {
        // this.#draw_point(this.startX, this.startY);
        points_to_draw.push({x: this.startX, y: this.startY})
      }

      for (var edge_id = 0; edge_id < current_segment.length; edge_id++) {
        // redraw each stored edge
        const current_edge = current_segment[edge_id];

        if (edge_id == 0) {
          // this.#draw_point(current_edge.x1, current_edge.y1);
          points_to_draw.push({x: current_edge.x1, y: current_edge.y1})
          this.ctx.moveTo(current_edge.x1, current_edge.y1);
        }

        // this.ctx.beginPath();
        this.ctx.lineTo(current_edge.x2, current_edge.y2);
        // this.#draw_point(current_edge.x2, current_edge.y2);
        points_to_draw.push({x: current_edge.x2, y: current_edge.y2})
      }
    }
    this.ctx.stroke();
    
    for (var point_id = 0; point_id < points_to_draw.length; point_id++) {
      this.#draw_point(points_to_draw[point_id].x, points_to_draw[point_id].y);
    }
    
  }

  rescale_canvas() {
    var body = $("body"); //this = window

    this.ctx.canvas.width = body.width();
    this.ctx_grid.canvas.width = body.width();    
    // this.ctx.canvas.height = body.height();

    $("#button_row").css({ top: (this.ctx.canvas.height + 15) + "px" });

    this.#draw_grid();
    this.#redrawStoredLines();
  }

  clear_data() {
    this.stop_drawing();
    this.stored_segments.length = 0;
    this.#reset_ctx_state();
  }

  undo_action() {
    this.stop_drawing();
    if (this.stored_segments.length == 0) {
      return false;
    }
    this.stored_segments[this.stored_segments.length - 1].pop();
    this.#redrawStoredLines();
  }
  
  stop_drawing() {
    this.isDrawing = false;
    this.current_segment_length = 0;

    try {
      if(this.stored_segments[this.stored_segments.length-1].length == 0) {
        this.stored_segments.pop(); // Remove the last segment as it is empty
      }
    } catch (error) {} // Ignore error
    

    this.#redrawStoredLines();
    write_angle("");
    write_distance(this.current_segment_length, 0);
    
  }

  drawing_step(e) {
    if (!this.isDrawing) {
      // Starting to draw
      var mouseX = parseInt(e.clientX - this.offsetX);
      var mouseY = parseInt(e.clientY - this.offsetY);

      this.startX = mouseX;
      this.startY = mouseY;

      this.isDrawing = true;
      this.first_edge = true;

      // Adding a new segment
      this.stored_segments.push([]);
    } else {
      // Adding a new point
      var mouseX = parseInt(e.clientX - this.offsetX);
      var mouseY = parseInt(e.clientY - this.offsetY);
      
      this.stored_segments[this.stored_segments.length - 1].push({
        x1: this.startX,
        y1: this.startY,
        x2: mouseX,
        y2: mouseY
      });

      this.current_segment_length += get_distance(this.startX, mouseX, this.startY, mouseY, this.distance_scale_factor);

      this.#redrawStoredLines();
  
      // Redefine starting point
      this.first_edge = false;
      this.startX = mouseX;
      this.startY = mouseY;
    }
  }

  handleMouseMove(e) {
    if (!this.isDrawing) {
      return;
    }

    if ((new Date).getTime() - this.last_update < this.refresh_rate) {
      return;
    }

    this.#redrawStoredLines();

    var mouseX = parseInt(e.clientX - this.offsetX);
    var mouseY = parseInt(e.clientY - this.offsetY);
    
    // draw the current line
    this.ctx.beginPath();
    this.ctx.moveTo(this.startX, this.startY);
    this.ctx.lineTo(mouseX, mouseY);
    this.ctx.stroke();
  
    var angle = compute_angle(this.startX, mouseX, this.startY, mouseY);
    var distance = get_distance(this.startX, mouseX, this.startY, mouseY, this.distance_scale_factor);
    write_angle(angle + "° (" + get_cardinal_direction(angle) + ")");
    write_distance(this.current_segment_length + distance, distance);

    this.last_update = (new Date).getTime();
  }
}

$( document ).ready(function() {
  var cvs_manager = new CanvasManager(
    distance_scale_factor=7, 
    stroke_style="orange", 
    stroke_width=3
  );

  $("#canvas").mousemove(function(e) {
    cvs_manager.handleMouseMove(e);
    e.stopPropagation();
  });

  $("#canvas").mouseout(function(e) {
    write_angle("");
    write_distance("", 0);
    e.stopPropagation();
  });

  $("#canvas").click(function(e) {
    cvs_manager.drawing_step(e);
    e.stopPropagation();
  });

  $("#clear").click(function(e) {
    cvs_manager.clear_data();
    e.stopPropagation();
  });

  $("#undo").click(function(e) {
    cvs_manager.undo_action();
    e.stopPropagation();
  });

  $('body').click(function(e){
    cvs_manager.stop_drawing();
    e.stopPropagation();
  });

  $(window).on('resize', function(){
    cvs_manager.rescale_canvas();
  });

  $(document).keyup(function(e) {
    if (e.key === "Escape") {
        cvs_manager.stop_drawing();
    }
    e.stopPropagation();
  });
});