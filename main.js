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
    refresh_rate=30
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

    this.max_canvas_size = 16384;

    // Camera is positioned at the top left corner, not the middle of the scene
    this.camera_location = {
      x: (this.max_canvas_size/2) - (this.canvas.width()/2),
      y: (this.max_canvas_size/2) - (this.canvas.height()/2),
    };

    this.rescale_canvas();

    this.cameraZoom = 1;
    this.MAX_ZOOM = 5;
    this.MIN_ZOOM = 0.1;
    this.SCROLL_SENSITIVITY = 0.0005;

  }

  #reset_ctx_state(clear_grid=false) {    
    this.ctx.clearRect(0, 0, this.max_canvas_size, this.max_canvas_size);
    if (clear_grid) {
      this.ctx_grid.clearRect(0, 0, this.max_canvas_size, this.max_canvas_size);
    }
  }

  #draw_grid(){
    this.ctx_grid.strokeStyle = "black";
    this.ctx_grid.lineWidth = 1;
    this.ctx_grid.globalAlpha = 0.1;

    for (var x = 0; x <= this.max_canvas_size; x += this.distance_scale_factor) {
      this.ctx_grid.moveTo(0.5 + x, 0);
      this.ctx_grid.lineTo(0.5 + x, this.max_canvas_size);
    }

    for (var x = 0; x <= this.max_canvas_size; x += this.distance_scale_factor) {
      this.ctx_grid.moveTo(0, 0.5 + x);
      this.ctx_grid.lineTo(this.max_canvas_size, 0.5 + x);
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

  #get_corrected_mouse_position(e){
    var mouseX = parseInt(e.clientX - this.offsetX);
    var mouseY = parseInt(e.clientY - this.offsetY);

    mouseX = this.camera_location.x + mouseX;
    mouseY = this.camera_location.y + mouseY;

    return {x: mouseX, y: mouseY};
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

    this.#reset_ctx_state(/*clear_grid=*/false);
    this.ctx.translate(-this.camera_location.x, -this.camera_location.y);
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
    var mouse_pos = this.#get_corrected_mouse_position(e);
    var mouseX = mouse_pos.x;
    var mouseY = mouse_pos.y;

    if (!this.isDrawing) {
      // Starting to draw
      this.startX = mouseX;
      this.startY = mouseY;

      this.isDrawing = true;
      this.first_edge = true;

      // Adding a new segment
      this.stored_segments.push([]);
    } else {
      // Adding a new point      
      this.stored_segments[this.stored_segments.length - 1].push({
        x1: this.startX,
        y1: this.startY,
        x2: mouseX,
        y2: mouseY
      });

      this.current_segment_length += get_distance(
        this.startX, mouseX, 
        this.startY, mouseY, 
        this.distance_scale_factor
      );

      this.#redrawStoredLines();
  
      // Redefine starting point
      this.first_edge = false;
      this.startX = mouseX;
      this.startY = mouseY;
    }
  }

  startPanningCamera(e) {
    if (this.isDrawing) {
      this.stop_drawing();
    }
    console.log(this.stored_segments);
    this.startX = parseInt(e.clientX - this.offsetX);
    this.startY = parseInt(e.clientY - this.offsetY);
  }

  stopPanningCamera(e) {
    this.handlePanningCamera(e, /*is_final=*/true);
  }

  handlePanningCamera(e, is_final=false) {
    var mouseX = parseInt(e.clientX - this.offsetX);
    var mouseY = parseInt(e.clientY - this.offsetY);

    var delta_x = mouseX - this.startX;
    var delta_y = mouseY - this.startY;

    // Reset the camera location to the new origin
    this.camera_location.x -= delta_x;
    this.camera_location.y -= delta_y;

    // Move the camera to the new place
    this.ctx.translate(delta_x, delta_y);

    // Redraw the scene
    this.#reset_ctx_state();
    this.#redrawStoredLines();

    if (!is_final){
      // Reset the camera location to the previous origin for the next iteration
      this.camera_location.x += delta_x;
      this.camera_location.y += delta_y;

      // Undo the translation for the next iteration
      this.ctx.translate(-delta_x, -delta_y);
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

    var mouse_pos = this.#get_corrected_mouse_position(e);
    var mouseX = mouse_pos.x;
    var mouseY = mouse_pos.y;
    
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

  function handle_mouse_move(e) {
    cvs_manager.handleMouseMove(e);
    e.stopPropagation();
  }

  function pan_canvas(e) {
    cvs_manager.handlePanningCamera(e);
    e.stopPropagation();
  }

  $("#canvas").on('click', function(e) {
    // Necessary to handle properly the mousedown event
    e.stopPropagation();
  });

  $("#canvas").on('mousedown', function(e) {
    if ( e.which == 2 ) {  // Middle click of the mouse
      cvs_manager.startPanningCamera(e);
      this.removeEventListener("mousemove", handle_mouse_move);
      this.addEventListener("mousemove", pan_canvas);
    } else {
      cvs_manager.drawing_step(e);
      e.preventDefault();
    }
  });

  $("#canvas").on('mouseup', function(e) {
    if( e.which == 2 ) {  // Middle click of the mouse
      cvs_manager.stopPanningCamera(e);
      this.addEventListener("mousemove", handle_mouse_move);
      this.removeEventListener("mousemove", pan_canvas);
    } else {
      e.preventDefault();
    }
  });

  $("#canvas").on('mousemove', handle_mouse_move);

  $("#canvas").on('mouseout', function(e) {
    write_angle("");
    write_distance("", 0);
    e.stopPropagation();
  });

  $("#clear").on('click', function(e) {
    cvs_manager.clear_data();
    e.stopPropagation();
  });

  $("#undo").on('click', function(e) {
    cvs_manager.undo_action();
    e.stopPropagation();
  });

  $('body').on('click', function(e){
    cvs_manager.stop_drawing();
    e.stopPropagation();
  });

  $(window).on('resize', function(e){
    cvs_manager.rescale_canvas();
    e.stopPropagation();
  });

  $(document).on('keyup', function(e){
    if (e.key === "Escape") {
        cvs_manager.stop_drawing();
    }
    e.stopPropagation();
  });
});