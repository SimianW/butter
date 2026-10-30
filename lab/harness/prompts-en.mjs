// English version of prompts-baseline.mjs, used for the English demo chat. Same topics, same
// demand for long derivations, so the answers render a similar amount of KaTeX.
export default [
  "I'm reviewing convex optimization; please answer in English throughout this chat. Explain convex functions in detail: give the definition, the first-order condition and the second-order condition, prove each condition completely, and work through 3 examples with full calculations.",
  'Next, explain positive definite and positive semidefinite matrices: the definitions and the equivalent tests (eigenvalues, principal minors, Cholesky). For each test, work through a complete example with a 3×3 matrix.',
  'Derive the convergence of gradient descent for unconstrained optimization: prove the O(1/k) rate for L-smooth convex functions, and state where every inequality comes from.',
  'Now derive the linear convergence rate of gradient descent in the strongly convex case, explain how the condition number κ = L/μ affects convergence, and give a concrete numerical example with a quadratic.',
  "Explain Newton's method: derive the iteration, prove quadratic convergence near the optimum, and carry out 4 full iterations on f(x) = x^4 - 3x^2 + 2.",
  'Explain the method of Lagrange multipliers in detail: derive the first-order necessary conditions for equality constraints, and fully solve: maximize x + 2y + 3z subject to x^2 + y^2 + z^2 = 1.',
  'Explain the KKT conditions: write out the full form, explain what every term means, and fully solve a two-dimensional quadratic program with two inequality constraints.',
  'Derive the Lagrange dual problem: define the dual function, prove weak duality, explain Slater’s condition and strong duality, and write the dual of a linear program and verify it.',
  'Explain the simplex method for linear programming: standard form, basic feasible solutions, reduced costs, and work a complete example with 3 variables and 3 constraints by hand (write out every simplex tableau).',
  'Explain the conjugate gradient method: derive the properties of A-conjugate directions, prove convergence in n steps for an n-dimensional positive definite quadratic, and do a complete calculation for a 2×2 system.',
];
